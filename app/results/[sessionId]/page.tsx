"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { CheckCircle, XCircle, Clock, Download, Home } from "lucide-react";

interface SessionResult {
  _id: string;
  userId: string;
  resumeData: any;
  role: string;
  experience: string;
  questionsPerRound: number;
  currentRound: number;
  questions: any[];
  answers: any[];
  status: string;
  createdAt: string;
  updatedAt: string;
}

export default function ResultsPage() {
  const params = useParams();
  const router = useRouter();
  const { isLoggedIn, isLoading } = useAuth();
  const sessionId = params.sessionId as string;
  
  const [session, setSession] = useState<SessionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      router.push("/auth/login");
      return;
    }

    if (!sessionId || !isLoggedIn) return;

    const fetchResults = async () => {
      try {
        const token = localStorage.getItem("authToken");
        const res = await fetch(`/api/interview/session?sessionId=${sessionId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (!res.ok) {
          throw new Error("Failed to fetch results");
        }

        const data = await res.json();
        setSession(data.session);
      } catch (err) {
        console.error("Error fetching results:", err);
        setError("Failed to load results");
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [sessionId, isLoggedIn, isLoading, router]);

  if (isLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="p-8 max-w-md text-center">
          <XCircle className="w-16 h-16 mx-auto mb-4 text-destructive" />
          <h2 className="text-2xl font-bold mb-2">Results Not Found</h2>
          <p className="text-muted-foreground mb-6">
            {error || "We couldn't find the results for this interview session."}
          </p>
          <Button onClick={() => router.push("/dashboard")}>
            <Home className="w-4 h-4 mr-2" />
            Go to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  const calculateScore = () => {
    if (!session.answers || session.answers.length === 0) return 0;
    const totalScore = session.answers.reduce((sum, ans) => {
      return sum + (ans.score || 0);
    }, 0);
    return Math.round((totalScore / session.answers.length) * 10) / 10;
  };

  const score = calculateScore();
  const totalQuestions = session.questions?.length || 0;
  const totalAnswers = session.answers?.length || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <Card className="p-6 md:p-8 text-center">
          <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Interview Complete!</h1>
          <p className="text-muted-foreground">
            Congratulations on completing your {session.role} interview
          </p>
        </Card>

        {/* Score Summary */}
        <Card className="p-6 md:p-8">
          <h2 className="text-2xl font-bold mb-6">Your Performance</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 rounded-lg bg-primary/10">
              <div className="text-4xl font-bold text-primary mb-2">{score}/10</div>
              <div className="text-sm text-muted-foreground">Overall Score</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-blue-500/10">
              <div className="text-4xl font-bold text-blue-500 mb-2">{totalAnswers}</div>
              <div className="text-sm text-muted-foreground">Questions Answered</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-purple-500/10">
              <div className="text-4xl font-bold text-purple-500 mb-2">3</div>
              <div className="text-sm text-muted-foreground">Rounds Completed</div>
            </div>
          </div>
        </Card>

        {/* Interview Details */}
        <Card className="p-6 md:p-8">
          <h2 className="text-2xl font-bold mb-4">Interview Details</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground">Role</span>
              <span className="font-semibold capitalize">{session.role}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground">Experience Level</span>
              <span className="font-semibold capitalize">{session.experience}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground">Questions Per Round</span>
              <span className="font-semibold">{session.questionsPerRound}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground">Status</span>
              <span className="font-semibold capitalize">{session.status}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-muted-foreground">Completed At</span>
              <span className="font-semibold">
                {new Date(session.updatedAt).toLocaleDateString()} at{" "}
                {new Date(session.updatedAt).toLocaleTimeString()}
              </span>
            </div>
          </div>
        </Card>

        {/* Email Notification */}
        <Card className="p-6 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                Results Sent to Your Email
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                We've sent a detailed report to {session.resumeData?.email || "your registered email"}. 
                Check your inbox for the complete analysis.
              </p>
            </div>
          </div>
        </Card>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Button
            onClick={() => router.push("/dashboard")}
            className="flex-1"
            size="lg"
          >
            <Home className="w-4 h-4 mr-2" />
            Go to Dashboard
          </Button>
          <Button
            onClick={() => router.push("/interview/setup")}
            variant="outline"
            className="flex-1"
            size="lg"
          >
            Start New Interview
          </Button>
        </div>
      </div>
    </div>
  );
}
