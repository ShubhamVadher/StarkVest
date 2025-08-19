// src/context/UserContext.js
import { createContext, useContext, useState } from 'react';

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [fund, setFund] = useState(0);

  return (
    <UserContext.Provider value={{ fund, setFund }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
