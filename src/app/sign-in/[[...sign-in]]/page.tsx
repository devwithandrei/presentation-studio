import Link from "next/link";
import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return <main className="share-error-page"><h1>Configure sign-in</h1><p>Add your Clerk keys to the environment variables. The demo remains available without an account.</p><Link href="/">Back to Studio</Link></main>;
  }
  return <main className="sign-in-page"><Link className="brand" href="/"><span className="brand-mark">S</span><span>studio<span className="brand-dot">.</span></span></Link><SignIn /></main>;
}
