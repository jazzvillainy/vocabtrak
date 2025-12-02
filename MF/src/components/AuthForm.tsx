import React, { useState } from "react";
import { Loader2, LogIn, UserPlus, Mail, Lock } from "lucide-react";
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
          password
        );
      } else {
        userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password
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
    <div className="max-w-md mx-auto p-8 bg-slate-800 rounded-xl shadow-2xl border border-slate-700 mt-16">
      <h2 className="text-3xl font-bold text-white mb-6 text-center">
        {isLogin ? "Sign In" : "Create Account"}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="relative">
          <Mail className="w-5 h-5 absolute top-3 left-3 text-slate-400" />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full pl-10 pr-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-sky-500 focus:border-sky-500"
          />
        </div>
        <div className="relative">
          <Lock className="w-5 h-5 absolute top-3 left-3 text-slate-400" />
          <input
            type="password"
            placeholder="Password (min 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full pl-10 pr-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-sky-500 focus:border-sky-500"
          />
        </div>

        {error && (
          <div className="text-red-400 bg-red-900/30 p-3 rounded-lg text-sm border border-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex justify-center items-center py-3 px-4 rounded-lg shadow-md text-lg font-medium text-white bg-sky-600 hover:bg-sky-700 disabled:bg-sky-800 disabled:opacity-70 transition-colors"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
          ) : isLogin ? (
            <>
              <LogIn className="w-5 h-5 mr-2" /> Sign In
            </>
          ) : (
            <>
              <UserPlus className="w-5 h-5 mr-2" /> Sign Up
            </>
          )}
        </button>
      </form>

      <button
        onClick={() => setIsLogin(!isLogin)}
        className="w-full mt-4 text-center text-sm text-slate-400 hover:text-sky-400 transition-colors"
      >
        {isLogin
          ? "Need an account? Sign Up"
          : "Already have an account? Sign In"}
      </button>
    </div>
  );
};
