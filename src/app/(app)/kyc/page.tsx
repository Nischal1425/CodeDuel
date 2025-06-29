
"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ShieldCheck, ShieldAlert, CheckCircle, ArrowLeft } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const IS_FIREBASE_CONFIGURED = !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

export default function KycPage() {
  const { player, isLoading } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleMockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!player) return;

    setIsSubmitting(true);
    toast({
      title: "Submission Received",
      description: "Your documents are being 'verified'. Please wait.",
    });

    // Simulate network delay and verification process
    await new Promise(resolve => setTimeout(resolve, 2500));

    if (IS_FIREBASE_CONFIGURED) {
      try {
        const playerRef = doc(db, "players", player.id);
        await updateDoc(playerRef, { isKycVerified: true });
      } catch (error) {
         console.error("KYC update failed:", error);
         toast({ title: "Error", description: "Failed to update your verification status.", variant: "destructive"});
         setIsSubmitting(false);
         return;
      }
    }
    
    // Auth context will update automatically via its real-time listener
    toast({
      title: "Verification Successful!",
      description: "You are now KYC verified and can redeem winnings.",
      className: "bg-green-500 text-white",
    });
    setIsSubmitting(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!player) {
    // Should be handled by layout, but as a fallback
    return <div className="text-center py-10">Please log in to view this page.</div>;
  }
  
  if (player.isKycVerified) {
    return (
       <div className="container mx-auto max-w-2xl py-8 text-center">
            <Card className="shadow-lg border-green-500/50">
                <CardHeader>
                    <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                    <CardTitle className="text-3xl text-green-600">You are KYC Verified!</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-lg text-muted-foreground">
                        Your account is fully verified. You have access to all Pro Circuit features, including redeeming your winnings.
                    </p>
                    <Button asChild>
                        <Link href="/profile"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Profile</Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl py-8">
      <Card className="shadow-xl">
        <CardHeader className="text-center">
          <ShieldAlert className="h-16 w-16 text-primary mx-auto mb-4" />
          <CardTitle className="text-3xl">KYC Verification</CardTitle>
          <CardDescription className="text-lg text-muted-foreground">
            Complete verification to unlock Pro features like coin redemption.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-6">
            <ShieldCheck className="h-4 w-4" />
            <AlertTitle>This is a mock process.</AlertTitle>
            <AlertDescription>
              For demonstration purposes, no real data is required or stored. Clicking submit will automatically approve your account.
            </AlertDescription>
          </Alert>
          <form onSubmit={handleMockSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="fullName">Full Legal Name</Label>
                <Input id="fullName" placeholder="John Doe" required disabled={isSubmitting} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dob">Date of Birth</Label>
                <Input id="dob" type="date" required disabled={isSubmitting} />
              </div>
            </div>
            <div className="space-y-1.5">
                <Label htmlFor="docType">Document Type</Label>
                <Select required disabled={isSubmitting}>
                    <SelectTrigger id="docType">
                        <SelectValue placeholder="Select a document" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="passport">Passport</SelectItem>
                        <SelectItem value="license">Driver's License</SelectItem>
                        <SelectItem value="id_card">National ID Card</SelectItem>
                    </SelectContent>
                </Select>
            </div>
             <div className="space-y-1.5">
                <Label htmlFor="docUpload">Upload Document</Label>
                <Input id="docUpload" type="file" required disabled={isSubmitting} />
             </div>
             <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                {isSubmitting ? 'Verifying...' : 'Submit for Verification'}
            </Button>
          </form>
        </CardContent>
        <CardFooter>
            <Button variant="link" asChild className="mx-auto">
                <Link href="/profile"><ArrowLeft className="mr-2 h-4 w-4"/> Go back</Link>
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
