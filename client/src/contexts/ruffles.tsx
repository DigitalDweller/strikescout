import { createContext, useCallback, useContext, useState } from "react";

const RufflesContext = createContext<{
  showRuffles: boolean;
  setShowRuffles: (v: boolean) => void;
  spawnTrigger: number;
  triggerSpawn: () => void;
}>({
  showRuffles: false,
  setShowRuffles: () => {},
  spawnTrigger: 0,
  triggerSpawn: () => {},
});

export function RufflesProvider({ children }: { children: React.ReactNode }) {
  const [showRuffles, setShowRuffles] = useState(false);
  const [spawnTrigger, setSpawnTrigger] = useState(0);
  const triggerSpawn = useCallback(() => {
    setShowRuffles(true);
    setSpawnTrigger((t) => t + 1);
  }, []);
  return (
    <RufflesContext.Provider value={{ showRuffles, setShowRuffles, spawnTrigger, triggerSpawn }}>
      {children}
    </RufflesContext.Provider>
  );
}

export function useRuffles() {
  return useContext(RufflesContext);
}
