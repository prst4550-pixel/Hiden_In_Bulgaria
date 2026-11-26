import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  BOOTSTRAPPED_ADMIN_EMAIL,
  BLUEPRINT_LIMITS,
  OperationType,
  handleFirestoreError,
  sanitizeFirestoreId,
} from '../firebase';
import { CommunitySuggestion, Place, Review, User } from '../types';

interface FirebaseContextValue {
  firebaseUser: FirebaseUser | null;
  authReady: boolean;
  appUserFromFirebase: User | null;
  firestoreFavorites: string[] | null;
  signInWithGoogle: () => Promise<User>;
  signOutFirebase: () => Promise<void>;
  toggleFavoriteInFirestore: (place: Place, shouldAdd: boolean) => Promise<void>;
  fetchReviewsFromFirestore: (placeId: string) => Promise<Review[]>;
  submitReviewToFirestore: (data: {
    placeId: string;
    author: string;
    rating: number;
    comment: string;
    visitSeason: string;
  }) => Promise<Review>;
  submitSuggestionToFirestore: (data: {
    name: string;
    region: string;
    category: string;
    latitude: number;
    longitude: number;
    description: string;
    source: string;
    imageUrl?: string;
  }) => Promise<CommunitySuggestion>;
  fetchSuggestionsFromFirestore: (isAdmin: boolean) => Promise<CommunitySuggestion[]>;
  updateSuggestionStatusInFirestore: (id: string, status: 'approved' | 'rejected') => Promise<void>;
  fetchUsersFromFirestore: () => Promise<User[]>;
}

const FirebaseContext = createContext<FirebaseContextValue | null>(null);

function mapFirebaseUserToAppUser(fbUser: FirebaseUser, storedRole?: 'admin' | 'user'): User {
  const isBootstrappedAdmin =
    fbUser.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase() &&
    fbUser.emailVerified;

  return {
    id: fbUser.uid,
    name: fbUser.displayName || fbUser.email?.split('@')[0] || 'Пътешественик',
    email: fbUser.email || '',
    role: isBootstrappedAdmin ? 'admin' : storedRole || 'user',
    createdAt: fbUser.metadata.creationTime || new Date().toISOString(),
  };
}

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [appUserFromFirebase, setAppUserFromFirebase] = useState<User | null>(null);
  const [firestoreFavorites, setFirestoreFavorites] = useState<string[] | null>(null);

  const ensureUserProfile = useCallback(async (fbUser: FirebaseUser): Promise<'admin' | 'user'> => {
    const uid = sanitizeFirestoreId(fbUser.uid, 'usr');
    const userRef = doc(db, 'users', uid);
    const path = `users/${uid}`;
    const isAdminEmail =
      fbUser.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase() &&
      fbUser.emailVerified;

    try {
      const snap = await getDoc(userRef);
      const safeName = (fbUser.displayName || fbUser.email?.split('@')[0] || 'Пътешественик')
        .trim()
        .slice(0, BLUEPRINT_LIMITS.displayNameMaxLength);
      const safeEmail = (fbUser.email || '').trim().slice(0, BLUEPRINT_LIMITS.emailMaxLength);
      const safePhoto = fbUser.photoURL ? fbUser.photoURL.slice(0, BLUEPRINT_LIMITS.photoURLMaxLength) : undefined;

      if (!snap.exists()) {
        const assignedRole: 'admin' | 'user' = isAdminEmail ? 'admin' : 'user';
        const profilePayload: Record<string, any> = {
          uid,
          displayName: safeName || 'Пътешественик',
          email: safeEmail,
          role: assignedRole,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        if (safePhoto) profilePayload.photoURL = safePhoto;

        if (fbUser.emailVerified && safeEmail) {
          await setDoc(userRef, profilePayload);
        }
        return assignedRole;
      } else {
        const existingData = snap.data();
        const role = (isAdminEmail ? 'admin' : existingData.role) as 'admin' | 'user';
        if (fbUser.emailVerified) {
          const updatePayload: Record<string, any> = {
            displayName: safeName || existingData.displayName || 'Пътешественик',
            updatedAt: serverTimestamp(),
          };
          if (safePhoto) updatePayload.photoURL = safePhoto;
          await updateDoc(userRef, updatePayload);
        }
        return role || 'user';
      }
    } catch (error) {
      // Surface permission or config errors cleanly while preserving non-fatal auth session
      console.warn('User profile sync error:', error);
      return isAdminEmail ? 'admin' : 'user';
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        const role = await ensureUserProfile(fbUser);
        setAppUserFromFirebase(mapFirebaseUserToAppUser(fbUser, role));
      } else {
        setAppUserFromFirebase(null);
        setFirestoreFavorites(null);
      }
      setAuthReady(true);
    });

    return () => unsubscribe();
  }, [ensureUserProfile]);

  // Attach favorites onSnapshot listener ONLY when auth is ready and user is authenticated
  useEffect(() => {
    if (!authReady || !firebaseUser) {
      return;
    }

    const favPath = `users/${firebaseUser.uid}/favorites`;
    const favCol = collection(db, 'users', firebaseUser.uid, 'favorites');
    const q = query(favCol, where('userId', '==', firebaseUser.uid));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const ids = snapshot.docs.map((d) => d.id);
        setFirestoreFavorites(ids);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, favPath);
      }
    );

    return () => unsubscribe();
  }, [authReady, firebaseUser]);

  const signInWithGoogle = async (): Promise<User> => {
    const credential = await signInWithPopup(auth, googleProvider);
    const role = await ensureUserProfile(credential.user);
    const mapped = mapFirebaseUserToAppUser(credential.user, role);
    setAppUserFromFirebase(mapped);
    return mapped;
  };

  const signOutFirebase = async (): Promise<void> => {
    await signOut(auth);
    setAppUserFromFirebase(null);
    setFirestoreFavorites(null);
  };

  const toggleFavoriteInFirestore = async (place: Place, shouldAdd: boolean): Promise<void> => {
    if (!firebaseUser) return;
    const placeId = sanitizeFirestoreId(place.id, 'place');
    const path = `users/${firebaseUser.uid}/favorites/${placeId}`;
    const docRef = doc(db, 'users', firebaseUser.uid, 'favorites', placeId);

    try {
      if (shouldAdd) {
        const payload: Record<string, any> = {
          userId: firebaseUser.uid,
          placeId,
          placeName: place.name.trim().slice(0, BLUEPRINT_LIMITS.placeNameMaxLength) || 'Обект',
          regionName: place.regionName.trim().slice(0, BLUEPRINT_LIMITS.regionNameMaxLength) || 'България',
          categoryName: place.categoryName.trim().slice(0, BLUEPRINT_LIMITS.categoryNameMaxLength) || 'Забележителност',
          createdAt: serverTimestamp(),
        };
        if (place.imageUrl) {
          payload.imageUrl = place.imageUrl.slice(0, BLUEPRINT_LIMITS.photoURLMaxLength);
        }
        await setDoc(docRef, payload);
      } else {
        await deleteDoc(docRef);
      }
    } catch (error) {
      handleFirestoreError(error, shouldAdd ? OperationType.WRITE : OperationType.DELETE, path);
    }
  };

  const fetchReviewsFromFirestore = async (placeId: string): Promise<Review[]> => {
    const safePlaceId = sanitizeFirestoreId(placeId, 'place');
    const path = 'reviews';
    try {
      const q = query(collection(db, path), where('placeId', '==', safePlaceId), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map((d) => {
        const data = d.data();
        const createdAt =
          data.createdAt && typeof data.createdAt.toDate === 'function'
            ? data.createdAt.toDate().toISOString()
            : new Date().toISOString();
        return {
          id: d.id,
          placeId: String(data.placeId),
          author: String(data.author),
          rating: Number(data.rating),
          comment: String(data.comment),
          visitSeason: String(data.visitSeason),
          createdAt,
        };
      });
    } catch (error: any) {
      // Fallback query without composite index requirement if index is still building
      if (String(error?.message || '').includes('index')) {
        try {
          const simpleQ = query(collection(db, path), where('placeId', '==', safePlaceId));
          const snap = await getDocs(simpleQ);
          return snap.docs.map((d) => {
            const data = d.data();
            const createdAt =
              data.createdAt && typeof data.createdAt.toDate === 'function'
                ? data.createdAt.toDate().toISOString()
                : new Date().toISOString();
            return {
              id: d.id,
              placeId: String(data.placeId),
              author: String(data.author),
              rating: Number(data.rating),
              comment: String(data.comment),
              visitSeason: String(data.visitSeason),
              createdAt,
            };
          });
        } catch (fallbackErr) {
          handleFirestoreError(fallbackErr, OperationType.LIST, path);
        }
      }
      handleFirestoreError(error, OperationType.LIST, path);
    }
  };

  const submitReviewToFirestore = async (data: {
    placeId: string;
    author: string;
    rating: number;
    comment: string;
    visitSeason: string;
  }): Promise<Review> => {
    if (!firebaseUser) {
      throw new Error('За публикуване на отзив в облачната база влезте с Google профил.');
    }
    const reviewId = sanitizeFirestoreId(`rev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
    const path = `reviews/${reviewId}`;
    const safePlaceId = sanitizeFirestoreId(data.placeId, 'place');
    const safeAuthor = data.author.trim().slice(0, BLUEPRINT_LIMITS.displayNameMaxLength) || 'Пътешественик';
    const safeRating = Math.min(5, Math.max(1, Math.round(Number(data.rating) || 5)));
    const safeComment = data.comment.trim().slice(0, BLUEPRINT_LIMITS.commentMaxLength);
    const safeSeason = data.visitSeason.trim().slice(0, BLUEPRINT_LIMITS.visitSeasonMaxLength) || 'Пролет';

    try {
      await setDoc(doc(db, 'reviews', reviewId), {
        placeId: safePlaceId,
        authorUid: firebaseUser.uid,
        author: safeAuthor,
        rating: safeRating,
        comment: safeComment,
        visitSeason: safeSeason,
        createdAt: serverTimestamp(),
      });
      return {
        id: reviewId,
        placeId: safePlaceId,
        author: safeAuthor,
        rating: safeRating,
        comment: safeComment,
        visitSeason: safeSeason,
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const submitSuggestionToFirestore = async (data: {
    name: string;
    region: string;
    category: string;
    latitude: number;
    longitude: number;
    description: string;
    source: string;
    imageUrl?: string;
  }): Promise<CommunitySuggestion> => {
    if (!firebaseUser) {
      throw new Error('Моля, влезте с Google профил, за да запишете предложението в облака.');
    }
    const suggestionId = sanitizeFirestoreId(`sug_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
    const path = `suggestions/${suggestionId}`;
    const safeName = data.name.trim().slice(0, BLUEPRINT_LIMITS.placeNameMaxLength);
    const safeRegion = data.region.trim().slice(0, BLUEPRINT_LIMITS.regionNameMaxLength);
    const safeCategory = data.category.trim().slice(0, BLUEPRINT_LIMITS.categoryNameMaxLength);
    const safeDesc = data.description.trim().slice(0, BLUEPRINT_LIMITS.descriptionMaxLength);
    const safeSource = (data.source || 'Лично посещение').trim().slice(0, BLUEPRINT_LIMITS.sourceMaxLength);
    const safeAuthorName = (firebaseUser.displayName || 'Откривател')
      .trim()
      .slice(0, BLUEPRINT_LIMITS.displayNameMaxLength);

    const payload: Record<string, any> = {
      authorUid: firebaseUser.uid,
      authorName: safeAuthorName,
      name: safeName,
      region: safeRegion,
      category: safeCategory,
      latitude: Number(data.latitude),
      longitude: Number(data.longitude),
      description: safeDesc,
      source: safeSource,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (data.imageUrl?.trim()) {
      payload.imageUrl = data.imageUrl.trim().slice(0, BLUEPRINT_LIMITS.photoURLMaxLength);
    }

    try {
      await setDoc(doc(db, 'suggestions', suggestionId), payload);
      return {
        id: suggestionId,
        name: safeName,
        region: safeRegion,
        category: safeCategory,
        latitude: Number(data.latitude),
        longitude: Number(data.longitude),
        description: safeDesc,
        source: safeSource,
        imageUrl: payload.imageUrl,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const fetchSuggestionsFromFirestore = async (isAdmin: boolean): Promise<CommunitySuggestion[]> => {
    if (!firebaseUser) return [];
    const path = 'suggestions';
    try {
      const q = isAdmin
        ? query(collection(db, path))
        : query(collection(db, path), where('authorUid', '==', firebaseUser.uid));
      const snap = await getDocs(q);
      return snap.docs.map((d) => {
        const data = d.data();
        const createdAt =
          data.createdAt && typeof data.createdAt.toDate === 'function'
            ? data.createdAt.toDate().toISOString()
            : new Date().toISOString();
        return {
          id: d.id,
          name: String(data.name),
          region: String(data.region),
          category: String(data.category),
          latitude: Number(data.latitude),
          longitude: Number(data.longitude),
          description: String(data.description),
          source: String(data.source),
          imageUrl: data.imageUrl ? String(data.imageUrl) : undefined,
          status: (data.status || 'pending') as 'pending' | 'approved' | 'rejected',
          createdAt,
        };
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  };

  const updateSuggestionStatusInFirestore = async (
    id: string,
    status: 'approved' | 'rejected'
  ): Promise<void> => {
    const safeId = sanitizeFirestoreId(id, 'sug');
    const path = `suggestions/${safeId}`;
    try {
      await updateDoc(doc(db, 'suggestions', safeId), {
        status,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const fetchUsersFromFirestore = async (): Promise<User[]> => {
    if (!firebaseUser) return [];
    const path = 'users';
    try {
      const snap = await getDocs(collection(db, path));
      return snap.docs.map((d) => {
        const data = d.data();
        const createdAt =
          data.createdAt && typeof data.createdAt.toDate === 'function'
            ? data.createdAt.toDate().toISOString()
            : new Date().toISOString();
        return {
          id: d.id,
          name: String(data.displayName || 'Потребител'),
          email: String(data.email || ''),
          role: (data.role === 'admin' ? 'admin' : 'user') as 'admin' | 'user',
          createdAt,
        };
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  };

  return (
    <FirebaseContext.Provider
      value={{
        firebaseUser,
        authReady,
        appUserFromFirebase,
        firestoreFavorites,
        signInWithGoogle,
        signOutFirebase,
        toggleFavoriteInFirestore,
        fetchReviewsFromFirestore,
        submitReviewToFirestore,
        submitSuggestionToFirestore,
        fetchSuggestionsFromFirestore,
        updateSuggestionStatusInFirestore,
        fetchUsersFromFirestore,
      }}
    >
      {children}
    </FirebaseContext.Provider>
  );
};

export function useFirebase() {
  const ctx = useContext(FirebaseContext);
  if (!ctx) {
    throw new Error('useFirebase must be used inside FirebaseProvider');
  }
  return ctx;
}
