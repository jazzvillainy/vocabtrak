import React, { useState } from "react";
import { Loader2, LogIn, UserPlus } from "lucide-react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { AuthFormProps } from "../types";
// import { FirebaseError } from "firebase/app";

export const AuthForm: React.FC<AuthFormProps> = ({ auth, onSuccess }) => {
  const [isLogin, setIsLogin] = useState<boolean>(true);
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!auth) return;

    setError("");
    setIsLoading(true);

    try {
      let userCredential;
      if (isLogin) {
        userCredential = await signInWithEmailAndPassword(
          auth,
          email,
          password,
        );
      } else {
        userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password,
        );
      }

      onSuccess(userCredential.user.uid);
    } catch (err) {
      console.error("Authentication Error:", err);
      // Handle Firebase error codes for user-friendly messages
      // if (err.code === "auth/email-already-in-use") {
      //   setError("This email is already registered. Try signing in.");
      // } else if (err.code === "auth/invalid-email") {
      //   setError("Invalid email format.");
      // } else if (err.code === "auth/weak-password") {
      //   setError("Password should be at least 6 characters.");
      // } else if (
      //   err.code === "auth/user-not-found" ||
      //   err.code === "auth/wrong-password"
      // ) {
      //   setError("Invalid email or password.");
      // } else {
      //   setError(`Authentication failed: ${err.message}`);
      // }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-md">
      <div className="w-full max-w-sm card">
        <h2 className="text-xl font-bold mb-lg text-center">
          {isLogin ? "Sign In" : "Create Account"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-lg">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-semibold mb-sm"
            >
              Email
            </label>
            <div className="relative">
              {/* <Mail className="w-4 h-4 absolute left-md top-1/2 transform -translate-y-1/2 icon pointer-events-none" /> */}
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full pl-2xl pr-md py-sm"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-semibold mb-sm"
            >
              Password
            </label>
            <div className="relative">
              {/* <Lock className="w-4 h-4 absolute left-md top-1/2 transform -translate-y-1/2 icon pointer-events-none" /> */}
              <input
                id="password"
                type="password"
                placeholder="Min 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full pl-2xl pr-md py-sm"
              />
            </div>
          </div>

          {error && (
            <div className="bg-error/10 border border-error text-error p-md rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary w-full flex justify-center items-center py-md"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin icon" />
            ) : isLogin ? (
              <>
                <LogIn className="w-4 h-4 icon mr-sm" />
                Sign In
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4 icon mr-sm" />
                Sign Up
              </>
            )}
          </button>
        </form>

        <button
          onClick={() => setIsLogin(!isLogin)}
          className="w-full mt-lg pt-lg border-t border-border text-center text-sm text-muted hover:text-accent transition-colors"
        >
          {isLogin
            ? "Need an account? Sign Up"
            : "Already have an account? Sign In"}
        </button>
      </div>
    </div>
  );
};
