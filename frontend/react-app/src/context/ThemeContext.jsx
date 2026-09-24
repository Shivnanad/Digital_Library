import React, { createContext, useContext, useState, useEffect } from 'react';

export const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [mood, setMoodState] = useState(localStorage.getItem('readify_mood') || 'focus');

  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const normalizedMood = mood || 'focus';
    document.body.setAttribute('data-mood', normalizedMood);
    localStorage.setItem('readify_mood', normalizedMood);
  }, [mood]);

  const toggleTheme = (e) => {
    const x = e?.clientX ?? window.innerWidth / 2;
    const y = e?.clientY ?? window.innerHeight / 2;
    
    document.documentElement.style.setProperty('--click-x', `${x}px`);
    document.documentElement.style.setProperty('--click-y', `${y}px`);

    const nextTheme = theme === 'light' ? 'dark' : 'light';

    if (!document.startViewTransition) {
      setTheme(nextTheme);
      return;
    }

    document.startViewTransition(() => {
      setTheme(nextTheme);
    });
  };

  const setMood = (nextMood) => {
    setMoodState(nextMood || 'focus');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, mood, setMood }}>
      {children}
    </ThemeContext.Provider>
  );
};
