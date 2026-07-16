import { useState, useEffect } from 'react';
import { Transaction, Budget, AppState, CustomCategory } from './types';
import { db, auth } from './firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function useFluxData() {
  const [data, setData] = useState<AppState>({ transactions: [], budgets: [], categories: [] });
  const [userId, setUserId] = useState<string | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);

  const updateSavingsCategories = async (categoryIds: string[]) => {
    if (!userId || !auth.currentUser) return;
    try {
      await setDoc(doc(db, 'users', userId), {
        uid: userId,
        email: auth.currentUser.email || '',
        savingsCategoryIds: categoryIds
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${userId}`);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUserId(user ? user.uid : null);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAuthReady || !userId) return;

    const userPath = `users/${userId}`;
    const unsubUser = onSnapshot(doc(db, 'users', userId), (docSnap) => {
      if (docSnap.exists()) {
        setUserProfile(docSnap.data());
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, userPath);
    });

    const transactionsPath = `users/${userId}/transactions`;
    const qTransactions = query(collection(db, transactionsPath), orderBy('date', 'desc'));
    
    const unsubTransactions = onSnapshot(qTransactions, (snapshot) => {
      const transactionsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString()
      })) as Transaction[];
      
      setData(prev => ({ ...prev, transactions: transactionsData }));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, transactionsPath);
    });

    const budgetsPath = `users/${userId}/budgets`;
    const qBudgets = query(collection(db, budgetsPath), orderBy('month', 'desc'));

    const unsubBudgets = onSnapshot(qBudgets, (snapshot) => {
      const budgetsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString()
      })) as Budget[];
      
      setData(prev => ({ ...prev, budgets: budgetsData }));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, budgetsPath);
    });

    const categoriesPath = `users/${userId}/categories`;
    const qCategories = query(collection(db, categoriesPath));

    const unsubCategories = onSnapshot(qCategories, (snapshot) => {
      const categoriesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString()
      })) as CustomCategory[];
      
      setData(prev => ({ ...prev, categories: categoriesData }));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, categoriesPath);
    });

    return () => {
      unsubUser();
      unsubTransactions();
      unsubBudgets();
      unsubCategories();
    };
  }, [userId, isAuthReady]);

  const addTransaction = async (transaction: Omit<Transaction, 'id' | 'createdAt' | 'authorUid'>) => {
    if (!userId) return;
    const newId = doc(collection(db, 'users', userId, 'transactions')).id;
    const path = `users/${userId}/transactions/${newId}`;
    try {
      await setDoc(doc(db, 'users', userId, 'transactions', newId), {
        ...transaction,
        authorUid: userId,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const deleteTransaction = async (id: string) => {
    if (!userId) return;
    const path = `users/${userId}/transactions/${id}`;
    try {
      await deleteDoc(doc(db, 'users', userId, 'transactions', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const updateTransaction = async (id: string, updatedData: Partial<Transaction>) => {
    if (!userId) return;
    const path = `users/${userId}/transactions/${id}`;
    try {
      await updateDoc(doc(db, 'users', userId, 'transactions', id), updatedData);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const updateBudget = async (month: string, category: string, amount: number) => {
    if (!userId) return;
    
    // Find existing budget
    const existingBudget = data.budgets.find(b => b.month === month && b.category === category);
    
    try {
      if (existingBudget) {
        const path = `users/${userId}/budgets/${existingBudget.id}`;
        await updateDoc(doc(db, 'users', userId, 'budgets', existingBudget.id), { amount });
      } else {
        const newId = doc(collection(db, 'users', userId, 'budgets')).id;
        const path = `users/${userId}/budgets/${newId}`;
        await setDoc(doc(db, 'users', userId, 'budgets', newId), {
          month,
          category,
          amount,
          authorUid: userId,
          createdAt: serverTimestamp()
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${userId}/budgets`);
    }
  };

  const deleteBudget = async (id: string) => {
    if (!userId) return;
    const path = `users/${userId}/budgets/${id}`;
    try {
      await deleteDoc(doc(db, 'users', userId, 'budgets', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const addCustomCategory = async (category: Omit<CustomCategory, 'id' | 'createdAt' | 'authorUid'>) => {
    if (!userId) return;
    const newId = doc(collection(db, 'users', userId, 'categories')).id;
    const path = `users/${userId}/categories/${newId}`;
    try {
      await setDoc(doc(db, 'users', userId, 'categories', newId), {
        ...category,
        authorUid: userId,
        createdAt: serverTimestamp()
      });
      return newId;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const deleteCustomCategory = async (id: string) => {
    if (!userId) return;
    const path = `users/${userId}/categories/${id}`;
    try {
      // 1. Delete the category document
      await deleteDoc(doc(db, 'users', userId, 'categories', id));

      // 2. Delete associated budgets
      const budgetsToDelete = data.budgets.filter(b => b.category === id);
      for (const budget of budgetsToDelete) {
        await deleteDoc(doc(db, 'users', userId, 'budgets', budget.id));
      }

      // 2.5 Reassign or delete transactions for this category
      const transactionsToUpdate = data.transactions.filter(t => t.category === id);
      for (const t of transactionsToUpdate) {
        // Fallback to a default category called 'Other' instead of deleting,
        // so the user doesn't lose their financial records entirely.
        await updateDoc(doc(db, 'users', userId, 'transactions', t.id), {
          category: 'Other'
        });
      }

      // 3. Remove from savingsCategoryIds
      const currentSavingsIds = userProfile?.savingsCategoryIds || [];
      if (currentSavingsIds.includes(id)) {
        const newSavingsIds = currentSavingsIds.filter((cid: string) => cid !== id);
        await setDoc(doc(db, 'users', userId), {
          savingsCategoryIds: newSavingsIds
        }, { merge: true });
      }

      // 4. Remove from savingsPlan
      const currentPlan = userProfile?.savingsPlan || {};
      let planChanged = false;
      const newPlan = { ...currentPlan };
      
      Object.keys(newPlan).forEach(period => {
        if (newPlan[period][id] !== undefined) {
          const { [id]: _, ...rest } = newPlan[period];
          newPlan[period] = rest;
          planChanged = true;
        }
      });

      if (planChanged) {
        await setDoc(doc(db, 'users', userId), {
          savingsPlan: newPlan
        }, { merge: true });
      }

    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const updateSavingsPlan = async (month: string, categoryId: string, amount: number) => {
    if (!userId) return;
    const path = `users/${userId}`;
    try {
      const currentPlan = userProfile?.savingsPlan || {};
      const monthPlan = currentPlan[month] || {};
      
      await setDoc(doc(db, 'users', userId), {
        uid: userId,
        email: auth.currentUser?.email || '',
        savingsPlan: {
          ...currentPlan,
          [month]: {
            ...monthPlan,
            [categoryId]: amount
          }
        }
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const updateYearlySavingsPlan = async (year: string, categoryId: string, amount: number) => {
    if (!userId) return;
    const path = `users/${userId}`;
    try {
      const currentPlan = userProfile?.savingsPlan || {};
      const newPlan = { ...currentPlan };
      
      for (let m = 1; m <= 12; m++) {
        const month = `${year}-${m.toString().padStart(2, '0')}`;
        const monthPlan = newPlan[month] || {};
        newPlan[month] = {
          ...monthPlan,
          [categoryId]: amount
        };
      }
      
      await setDoc(doc(db, 'users', userId), {
        uid: userId,
        email: auth.currentUser?.email || '',
        savingsPlan: newPlan
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const updateFullSavingsPlan = async (fullPlan: any) => {
    if (!userId) return;
    const path = `users/${userId}`;
    try {
      await setDoc(doc(db, 'users', userId), {
        uid: userId,
        email: auth.currentUser?.email || '',
        savingsPlan: fullPlan
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  return { data, addTransaction, deleteTransaction, updateTransaction, updateBudget, deleteBudget, addCustomCategory, deleteCustomCategory, updateSavingsCategories, updateSavingsPlan, updateYearlySavingsPlan, updateFullSavingsPlan, userId, isAuthReady, userProfile };
}
