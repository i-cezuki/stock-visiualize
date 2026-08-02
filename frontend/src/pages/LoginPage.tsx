import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { forgotPassword, confirmPassword } from "../auth/cognitoAuth";

type View = "sign-in" | "request-reset" | "confirm-reset";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState<View>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  function switchView(nextView: View) {
    setError(null);
    setInfoMessage(null);
    setView(nextView);
  }

  async function handleSignIn(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate("/", { replace: true });
    } catch {
      setError("メールアドレスまたはパスワードが正しくありません");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRequestReset(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await forgotPassword(email);
      setInfoMessage("確認コードをメールで送信しました");
      setView("confirm-reset");
    } catch {
      setError("確認コードの送信に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleConfirmReset(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await confirmPassword(email, code, newPassword);
      setInfoMessage("パスワードを更新しました。ログインしてください");
      setView("sign-in");
    } catch {
      setError("パスワードの更新に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 bg-[#F5EFE6] px-6 text-stone-800 dark:bg-stone-900 dark:text-stone-100">
      <h1 className="text-center text-2xl font-bold">調味料在庫</h1>

      {infoMessage && <p className="text-center text-sm text-emerald-700 dark:text-emerald-400">{infoMessage}</p>}
      {error && <p className="text-center text-sm text-red-600 dark:text-red-400">{error}</p>}

      {view === "sign-in" && (
        <form onSubmit={handleSignIn} className="flex flex-col gap-3">
          <input
            type="email"
            required
            placeholder="メールアドレス"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-xl border border-stone-300 px-4 py-3 dark:border-stone-600 dark:bg-stone-800"
          />
          <input
            type="password"
            required
            placeholder="パスワード"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-xl border border-stone-300 px-4 py-3 dark:border-stone-600 dark:bg-stone-800"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-xl bg-stone-800 px-4 py-3 font-semibold text-white disabled:opacity-50 dark:bg-stone-100 dark:text-stone-900"
          >
            ログイン
          </button>
          <button
            type="button"
            onClick={() => switchView("request-reset")}
            className="text-sm text-stone-500 underline dark:text-stone-400"
          >
            パスワードを忘れた場合
          </button>
        </form>
      )}

      {view === "request-reset" && (
        <form onSubmit={handleRequestReset} className="flex flex-col gap-3">
          <input
            type="email"
            required
            placeholder="メールアドレス"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-xl border border-stone-300 px-4 py-3 dark:border-stone-600 dark:bg-stone-800"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-xl bg-stone-800 px-4 py-3 font-semibold text-white disabled:opacity-50 dark:bg-stone-100 dark:text-stone-900"
          >
            確認コードを送信
          </button>
          <button type="button" onClick={() => switchView("sign-in")} className="text-sm text-stone-500 underline dark:text-stone-400">
            ログインに戻る
          </button>
        </form>
      )}

      {view === "confirm-reset" && (
        <form onSubmit={handleConfirmReset} className="flex flex-col gap-3">
          <input
            required
            placeholder="確認コード"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="rounded-xl border border-stone-300 px-4 py-3 dark:border-stone-600 dark:bg-stone-800"
          />
          <input
            type="password"
            required
            placeholder="新しいパスワード"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="rounded-xl border border-stone-300 px-4 py-3 dark:border-stone-600 dark:bg-stone-800"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-xl bg-stone-800 px-4 py-3 font-semibold text-white disabled:opacity-50 dark:bg-stone-100 dark:text-stone-900"
          >
            パスワードを更新
          </button>
        </form>
      )}
    </div>
  );
}
