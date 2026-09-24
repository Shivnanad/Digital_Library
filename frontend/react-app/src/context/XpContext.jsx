import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext";

const XpContext = createContext(null);

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const XP_PER_LEVEL = 2000;
const XP_STORAGE_VERSION = 2;

function getLevelFromXp(totalXp) {
  return Math.max(1, Math.floor(Number(totalXp || 0) / XP_PER_LEVEL) + 1);
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysBetween(previousDateKey, currentDateKey) {
  if (!previousDateKey || !currentDateKey) return null;
  const previousDate = new Date(`${previousDateKey}T00:00:00`);
  const currentDate = new Date(`${currentDateKey}T00:00:00`);
  return Math.floor((currentDate.getTime() - previousDate.getTime()) / DAY_IN_MILLISECONDS);
}

export function XpProvider({ children }) {
  const auth = useAuth();
  const user = auth?.user || null;
  const userEmail = user?.email || "guest";
  const [xpState, setXpState] = useState({
    totalXp: 0,
    walletXp: 0,
    streakDays: 0,
    level: 1,
    lastActiveDate: null,
    moodHistory: [],
    dailyTasks: {},
  });

  const storageKey = useMemo(() => {
    const email = user?.email || "guest";
    return `readify_xp_v${XP_STORAGE_VERSION}_${email}`;
  }, [user?.email]);

  const legacyStorageKey = useMemo(() => {
    const email = user?.email || "guest";
    return `readify_xp_${email}`;
  }, [user?.email]);

  useEffect(() => {
    try {
      // Hard reset previous XP system state for all existing accounts.
      localStorage.removeItem(legacyStorageKey);

      const saved = localStorage.getItem(storageKey);
      if (!saved) {
        setXpState({
          totalXp: 0,
          walletXp: 0,
          streakDays: 0,
          level: 1,
          lastActiveDate: null,
          moodHistory: [],
          dailyTasks: {},
        });
        return;
      }

      const parsed = JSON.parse(saved);
      if (!parsed || typeof parsed !== "object") return;

      const totalXp = Number(parsed.totalXp || 0);
      const walletXp = Number(parsed.walletXp ?? totalXp);
  const level = getLevelFromXp(totalXp);

      setXpState({
        totalXp,
        walletXp,
        streakDays: Number(parsed.streakDays || 0),
        level,
        lastActiveDate: parsed.lastActiveDate || null,
        moodHistory: Array.isArray(parsed.moodHistory) ? parsed.moodHistory : [],
        dailyTasks: parsed.dailyTasks && typeof parsed.dailyTasks === "object" ? parsed.dailyTasks : {},
      });
    } catch (error) {
      console.error("Failed to load XP state:", error);
    }
  }, [legacyStorageKey, storageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(xpState));
    } catch (error) {
      console.error("Failed to save XP state:", error);
    }
  }, [storageKey, xpState]);

  const addXp = useCallback((amount, reason = "activity") => {
    setXpState((previous) => {
      const amountNumber = Number(amount || 0);
      const xpGain = amountNumber > 0 ? amountNumber : 0;
      const updatedXp = Math.max(0, Number(previous.totalXp || 0) + xpGain);
      const updatedWalletXp = Math.max(0, Number(previous.walletXp || 0) + amountNumber);
      const updatedLevel = getLevelFromXp(updatedXp);
      const now = new Date();
      const dateKey = toDateKey(now);
      const updatedMoodHistory = previous.moodHistory.slice(0, 29);

      if (reason) {
        updatedMoodHistory.unshift({
          type: reason,
          date: dateKey,
          time: now.toISOString(),
          xp: Number(amount || 0),
        });
      }

      return {
        ...previous,
        totalXp: updatedXp,
        walletXp: updatedWalletXp,
        level: updatedLevel,
        moodHistory: updatedMoodHistory,
      };
    });
  }, []);

  const registerDailyVisit = useCallback(() => {
    setXpState((previous) => {
      const todayKey = toDateKey(new Date());
      if (previous.lastActiveDate === todayKey) return previous;

      const dayGap = daysBetween(previous.lastActiveDate, todayKey);
      const nextStreak = dayGap === 1 ? Number(previous.streakDays || 0) + 1 : 1;
      const rewardedXp = 15;
      const awardedXp = Number(previous.totalXp || 0) + rewardedXp;
      const awardedWalletXp = Number(previous.walletXp || 0) + rewardedXp;
      const nextLevel = getLevelFromXp(awardedXp);

      return {
        ...previous,
        totalXp: awardedXp,
        walletXp: awardedWalletXp,
        streakDays: nextStreak,
        level: nextLevel,
        lastActiveDate: todayKey,
      };
    });
  }, []);

  const registerMoodSelection = useCallback((moodKey) => {
    if (!moodKey) return;

    setXpState((previous) => {
      const now = new Date();
      const dateKey = toDateKey(now);
      const updatedMoodHistory = previous.moodHistory.slice(0, 29);
      updatedMoodHistory.unshift({
        type: `mood:${moodKey}`,
        date: dateKey,
        time: now.toISOString(),
        xp: 0,
      });

      return {
        ...previous,
        moodHistory: updatedMoodHistory,
      };
    });
  }, []);

  const canClaimDailyTask = useCallback((taskId) => {
    if (!taskId) return false;
    const todayKey = toDateKey(new Date());
    return !Boolean(xpState.dailyTasks?.[todayKey]?.[taskId]);
  }, [xpState.dailyTasks]);

  const claimDailyTask = useCallback((taskId, reward = 0) => {
    if (!taskId) {
      return { ok: false, message: "Invalid task." };
    }

    const rewardValue = Math.max(0, Number(reward || 0));
    let didClaim = false;

    setXpState((previous) => {
      const todayKey = toDateKey(new Date());
      const todayTasks = previous.dailyTasks?.[todayKey] || {};
      if (todayTasks[taskId]) return previous;

      didClaim = true;
      const nextTotalXp = Number(previous.totalXp || 0) + rewardValue;
      const nextWalletXp = Number(previous.walletXp || 0) + rewardValue;
      const nextLevel = getLevelFromXp(nextTotalXp);
      const now = new Date();
      const nextHistory = previous.moodHistory.slice(0, 29);
      nextHistory.unshift({
        type: `task:${taskId}`,
        date: todayKey,
        time: now.toISOString(),
        xp: rewardValue,
      });

      return {
        ...previous,
        totalXp: nextTotalXp,
        walletXp: nextWalletXp,
        level: nextLevel,
        moodHistory: nextHistory,
        dailyTasks: {
          ...previous.dailyTasks,
          [todayKey]: {
            ...todayTasks,
            [taskId]: true,
          },
        },
      };
    });

    if (!didClaim) {
      return { ok: false, message: "Task already claimed today." };
    }

    return { ok: true, message: `+${rewardValue} XP added to wallet.` };
  }, []);

  const spendXp = useCallback((amount, reason = "redeem") => {
    const amountValue = Math.max(0, Number(amount || 0));
    if (!amountValue) return { ok: false, message: "Invalid XP amount." };

    let wasSpent = false;
    setXpState((previous) => {
      const currentWallet = Number(previous.walletXp || 0);
      if (currentWallet < amountValue) return previous;

      wasSpent = true;
      const now = new Date();
      const dateKey = toDateKey(now);
      const updatedHistory = previous.moodHistory.slice(0, 29);
      updatedHistory.unshift({
        type: `spend:${reason}`,
        date: dateKey,
        time: now.toISOString(),
        xp: -amountValue,
      });

      return {
        ...previous,
        walletXp: currentWallet - amountValue,
        moodHistory: updatedHistory,
      };
    });

    if (!wasSpent) {
      return { ok: false, message: "Not enough XP in wallet." };
    }

    return { ok: true, message: `Redeemed ${amountValue} XP.` };
  }, []);

  const redeemBookWithXp = useCallback((book, cost) => {
    if (!book || !book._id) {
      return { ok: false, message: "Invalid book selected." };
    }

    const spendResult = spendXp(cost, `book:${book._id}`);
    if (!spendResult.ok) return spendResult;

    try {
      const purchasesKey = `readify_xp_purchases_${userEmail}`;
      const existing = JSON.parse(localStorage.getItem(purchasesKey) || "[]");
      const nextPurchases = Array.isArray(existing) ? existing : [];
      nextPurchases.unshift({
        bookId: book._id,
        title: book.title || "Untitled",
        author: book.author || "Unknown",
        coverUrl: book.coverUrl || book.cover || "",
        xpCost: Number(cost || 0),
        purchasedAt: new Date().toISOString(),
      });
      localStorage.setItem(purchasesKey, JSON.stringify(nextPurchases.slice(0, 100)));
    } catch (error) {
      console.error("Failed to persist XP purchase:", error);
    }

    return { ok: true, message: `${book.title || "Book"} unlocked with XP.` };
  }, [spendXp, userEmail]);

  const value = useMemo(() => ({
    ...xpState,
    addXp,
    registerDailyVisit,
    registerMoodSelection,
    canClaimDailyTask,
    claimDailyTask,
    spendXp,
    redeemBookWithXp,
  }), [
    addXp,
    canClaimDailyTask,
    claimDailyTask,
    redeemBookWithXp,
    registerDailyVisit,
    registerMoodSelection,
    spendXp,
    xpState,
  ]);

  return <XpContext.Provider value={value}>{children}</XpContext.Provider>;
}

export function useXp() {
  const context = useContext(XpContext);
  if (!context) {
    return {
      totalXp: 0,
      walletXp: 0,
      streakDays: 0,
      level: 1,
      lastActiveDate: null,
      moodHistory: [],
      dailyTasks: {},
      addXp: () => {},
      registerDailyVisit: () => {},
      registerMoodSelection: () => {},
      canClaimDailyTask: () => false,
      claimDailyTask: () => ({ ok: false, message: "XP provider unavailable." }),
      spendXp: () => ({ ok: false, message: "XP provider unavailable." }),
      redeemBookWithXp: () => ({ ok: false, message: "XP provider unavailable." }),
    };
  }
  return context;
}
