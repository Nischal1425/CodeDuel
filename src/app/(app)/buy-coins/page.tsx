
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardFooter, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DollarSign, CreditCard, ShoppingCart } from "lucide-react";
import Image from "next/image";

const coinPackages = [
  { coins: 500, priceINR: 50, popular: false, dataAiHint: "coins pile" },
  { coins: 1000, priceINR: 90, popular: true, dataAiHint: "treasure chest" }, 
  { coins: 2500, priceINR: 220, popular: false, dataAiHint: "gold bars" }, 
  { coins: 5000, priceINR: 425, popular: false, dataAiHint: "vault door"}, 
  { coins: 10000, priceINR: 800, popular: false, dataAiHint: "money bag"}, 
];

export default function BuyCoinsPage() {
  return (
    <div className="container mx-auto max-w-3xl py-8">
      <Card className="shadow-xl border-primary/20">
        <CardHeader className="text-center items-center bg-gradient-to-br from-primary to-accent text-primary-foreground py-10 rounded-t-lg">
          <DollarSign className="h-16 w-16 mb-4 opacity-80" />
          <CardTitle className="text-4xl font-bold">Buy Coins</CardTitle>
          <CardDescription className="text-lg mt-2 text-primary-foreground/80">
            Stock up on coins to dominate the Code Duel arena! (₹10 = 100 coins base rate)
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 md:p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {coinPackages.map((pkg) => (
              <Card 
                key={pkg.coins} 
                className={`overflow-hidden hover:shadow-lg transition-shadow duration-200 ${pkg.popular ? 'border-2 border-accent shadow-accent/30' : 'border'}`}
              >
                {pkg.popular && (
                  <div className="bg-accent text-accent-foreground text-xs font-semibold py-1 px-3 text-center">POPULAR</div>
                )}
                <CardHeader className="items-center text-center p-4">
                   <Image src={`https://placehold.co/100x80.png`} alt={`${pkg.coins} coins package`} width={100} height={80} data-ai-hint={pkg.dataAiHint} className="mb-2 rounded-md" />
                  <CardTitle className="text-2xl text-primary">{pkg.coins.toLocaleString()} Coins</CardTitle>
                </CardHeader>
                <CardContent className="text-center p-4 pt-0">
                  <p className="text-3xl font-bold text-foreground mb-2">₹{pkg.priceINR}</p>
                  { (pkg.priceINR / pkg.coins * 100 < 10) && 
                    <p className="text-sm text-green-600">Save { (100 - (pkg.priceINR / pkg.coins * 1000)).toFixed(0) }%!</p> 
                  }
                </CardContent>
                <CardFooter className="p-4">
                  <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                    <ShoppingCart className="mr-2 h-4 w-4" /> Buy Now
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
          
          <Card className="bg-muted/30 p-6">
            <CardTitle className="text-xl mb-4 text-foreground">Custom Amount</CardTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
              <div>
                <Label htmlFor="custom-coins" className="text-sm">Enter Coins Amount</Label>
                <Input id="custom-coins" type="number" placeholder="e.g., 1500" className="mt-1"/>
              </div>
              <Button className="w-full md:w-auto bg-accent hover:bg-accent/90 text-accent-foreground">
                <CreditCard className="mr-2 h-4 w-4" /> Proceed to Payment
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Minimum purchase: 100 coins (₹10).</p>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}
