"use client";

import type { ShoppingListItem } from "@/types";
import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";

interface ShoppingListContextType {
  items: ShoppingListItem[];
  addItem: (itemDetails: Omit<ShoppingListItem, "id" | "isChecked">) => void;
  addMultipleItems: (itemsDetails: Omit<ShoppingListItem, "id" | "isChecked">[]) => void;
  removeItem: (itemId: string) => void;
  toggleItemChecked: (itemId: string) => void;
  clearList: () => void;
  loading: boolean;
}

const ShoppingListContext = createContext<ShoppingListContextType | undefined>(undefined);

export const ShoppingListProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedItems = localStorage.getItem("oppskriftShoppingList");
    if (storedItems) {
      setItems(JSON.parse(storedItems));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!loading) {
      localStorage.setItem("oppskriftShoppingList", JSON.stringify(items));
    }
  }, [items, loading]);

  const addItem = useCallback((itemDetails: Omit<ShoppingListItem, "id" | "isChecked">) => {
    const newItem: ShoppingListItem = {
      ...itemDetails,
      id: uuidv4(),
      isChecked: false,
    };
    setItems((prevItems) => [...prevItems, newItem]);
  }, []);

  const addMultipleItems = useCallback((itemsDetails: Omit<ShoppingListItem, "id" | "isChecked">[]) => {
    const newItems: ShoppingListItem[] = itemsDetails.map(detail => ({
      ...detail,
      id: uuidv4(),
      isChecked: false,
    }));
    setItems((prevItems) => [...prevItems, ...newItems]);
  }, []);


  const removeItem = useCallback((itemId: string) => {
    setItems((prevItems) => prevItems.filter((item) => item.id !== itemId));
  }, []);

  const toggleItemChecked = useCallback((itemId: string) => {
    setItems((prevItems) =>
      prevItems.map((item) =>
        item.id === itemId ? { ...item, isChecked: !item.isChecked } : item
      )
    );
  }, []);

  const clearList = useCallback(() => {
    setItems([]);
  }, []);

  // Prevent hydration mismatch for localStorage access
  const [hasMounted, setHasMounted] = React.useState(false);
  React.useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted && loading) {
    return null; 
  }

  return (
    <ShoppingListContext.Provider value={{ items, addItem, addMultipleItems, removeItem, toggleItemChecked, clearList, loading }}>
      {children}
    </ShoppingListContext.Provider>
  );
};

export const useShoppingList = (): ShoppingListContextType => {
  const context = useContext(ShoppingListContext);
  if (context === undefined) {
    throw new Error("useShoppingList must be used within a ShoppingListProvider");
  }
  return context;
};
