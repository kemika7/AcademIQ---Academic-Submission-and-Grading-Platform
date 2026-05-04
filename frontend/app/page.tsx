import Link from "next/link";
import { ArrowRight, Bot, GitBranch, GraduationCap, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LandingRedirect } from "@/components/auth/LandingRedirect";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
      <LandingRedirect />
      <header className="container flex items-center justify-between py-6">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
          <Sparkles className="h-5 w-5 text-primary" />
          AcademIQ
        </Link>
        <nav className="flex gap-2">
          <Button asChild variant="ghost"><Link href="/login">Sign in</Link></Button>
          <Button asChild><Link href="/register">Get started</Link></Button>
        </nav>
      </header>

      <section className="container py-24 text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border bg-muted/50 px-3 py-1 text-xs text-muted-foreground">
          <Bot className="h-3 w-3" /> AI-graded reports · GitHub analysis · Rubrics
        </div>
        <h1 className="mx-auto mt-6 max-w-3xl text-balance text-5xl font-semibold tracking-tight md:text-6xl">
          Submit. Analyze. Grade. <span className="text-primary">In one place.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-balance text-muted-foreground">
          Built for university capstone and project-based courses. Students ship code and reports;
          instructors grade with AI assistance instead of by hand.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/register">I'm a student <ArrowRight className="h-4 w-4" /></Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/register?role=instructor">I'm a teacher</Link>
          </Button>
        </div>
      </section>

      <section className="container grid gap-6 pb-24 md:grid-cols-3">
        {[
          { icon: Bot, title: "AI report insights", body: "Summary, weaknesses, and concrete suggestions on every submission." },
          { icon: GitBranch, title: "GitHub analysis", body: "Languages, contributors, commit history, and a quality score." },
          { icon: GraduationCap, title: "Rubric grading", body: "Instructor-defined criteria with weighted scores and per-criterion comments." },
        ].map(({ icon: Icon, title, body }) => (
          <Card key={title} className="transition-shadow hover:shadow-md">
            <CardContent className="p-6">
              <Icon className="h-6 w-6 text-primary" />
              <h3 className="mt-4 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} AcademIQ
      </footer>
    </div>
  );
}
