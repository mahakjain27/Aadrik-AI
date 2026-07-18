import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(
        localStorage.getItem("token") || sessionStorage.getItem("token") || ""
    );

    useEffect(() => {
        const savedUser = localStorage.getItem("user") || sessionStorage.getItem("user");

        if (savedUser) {
            setUser(JSON.parse(savedUser));
        }
    }, []);

    function login(data, remember = true) {
        setToken(data.access_token);

        const userInfo = {
            id: data.id,
            name: data.name,
            role: data.role,
            email: data.email,
        };

        setUser(userInfo);

        const store = remember ? localStorage : sessionStorage;
        const other = remember ? sessionStorage : localStorage;

        other.removeItem("token");
        other.removeItem("user");

        store.setItem("token", data.access_token);
        store.setItem("user", JSON.stringify(userInfo));
    }

    function updateUser(partial) {
        setUser((prev) => {
            const next = { ...prev, ...partial };

            const store = localStorage.getItem("user") ? localStorage : sessionStorage;
            store.setItem("user", JSON.stringify(next));

            return next;
        });
    }

    function logout() {
        setToken("");
        setUser(null);

        localStorage.removeItem("token");
        localStorage.removeItem("user");
        sessionStorage.removeItem("token");
        sessionStorage.removeItem("user");
    }

    return (
        <AuthContext.Provider
            value={{
                token,
                user,
                login,
                logout,
                updateUser,
                isAuthenticated: !!token,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}