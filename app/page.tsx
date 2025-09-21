import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <Card className="max-w-2xl w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold">Python Detection Rule Validator</CardTitle>
          <CardDescription className="text-lg mt-2">
            Validate and improve your Panther detection rules using AI-powered analysis
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Features:</h3>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Python syntax validation</li>
              <li>Panther detection rule compliance checking</li>
              <li>Code quality assessment</li>
              <li>AI-powered improvement suggestions</li>
              <li>Real-time feedback and analysis</li>
            </ul>
          </div>

          <div className="flex justify-center pt-4">
            <Link href="/validator">
              <Button size="lg" className="w-full sm:w-auto">
                Start Validating Code
              </Button>
            </Link>
          </div>

          <div className="text-center text-sm text-muted-foreground pt-4">
            <p>Powered by Amazon Bedrock and Claude AI</p>
            <p className="mt-2">
              Make sure to configure your AWS credentials in the environment variables
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
