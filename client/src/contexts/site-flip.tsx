import { createContext, useContext, useState } from "react";

const SiteFlipContext = createContext<{
  flipped: boolean;
  setFlipped: (v: boolean) => void;
}>({ flipped: false, setFlipped: () => {} });

export function SiteFlipProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [flipped, setFlipped] = useState(false);
  return (
    <SiteFlipContext.Provider value={{ flipped, setFlipped }}>
      {children}
    </SiteFlipContext.Provider>
  );
}

export function useSiteFlip() {
  return useContext(SiteFlipContext);
}
