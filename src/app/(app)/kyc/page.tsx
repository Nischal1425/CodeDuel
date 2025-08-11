"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, ShieldCheck } from 'lucide-react';

export default function KycPage() {
  const { player } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    documentId: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName || !formData.documentId) {
      toast({
        title: 'Missing Information',
        description: 'Please fill out all fields.',
        variant: 'destructive',
      });
      return;
    }
    setIsLoading(true);
    // In a real app, you would send this data to a secure backend for verification.
    // Here, we'll just simulate the process.
    setTimeout(() => {
      toast({
        title: 'Submission Received',
        description: 'Your KYC documents are under review.',
        className: 'bg-green-500 text-white',
      });
      setIsLoading(false);
    }, 2000);
  };

  if (player?.isKycVerified) {
    return (
        <div className="container mx-auto max-w-2xl py-8">
            <Card className="text-center bg-green-50 border-green-500">
                <CardHeader>
                    <ShieldCheck className="h-16 w-16 text-green-600 mx-auto mb-4" />
                    <CardTitle className="text-2xl text-green-700">You are Verified!</CardTitle>
                    <CardDescription className="text-green-600">
                        Your account has been successfully verified. You can now access all features.
                    </CardDescription>
                </CardHeader>
            </Card>
        </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl py-8">
      <form onSubmit={handleSubmit}>
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-3xl">KYC Verification</CardTitle>
            <CardDescription>
              Please submit your details for verification to unlock all features, including coin redemption.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                placeholder="John Doe"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="documentId">Government ID Number</Label>
              <Input
                id="documentId"
                placeholder="e.g., AADHAR, PAN, or Passport Number"
                value={formData.documentId}
                onChange={(e) => setFormData({ ...formData, documentId: e.target.value })}
                disabled={isLoading}
              />
            </div>
             <div className="space-y-2">
                <Label htmlFor="documentUpload">Upload Document</Label>
                <Input id="documentUpload" type="file" disabled={isLoading} />
                <p className="text-xs text-muted-foreground">Please upload a clear image of your ID document.</p>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit for Verification
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
