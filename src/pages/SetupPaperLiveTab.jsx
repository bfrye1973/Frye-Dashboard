import React, { useEffect, useState } from "react";
import FerrariCluster from "@/components/FerrariCluster";
import { subscribeGauges, subscribeSignals } from "@/services/tos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { RefreshCcw, Activity, Database, Shield, Settings } from "lucide-react";

export default function SetupPaperLiveTab() {
  const [isLive, setIsLive] = useState(false);

  // Gauges + lights
  const [gauges, setGauges] = useState({ rpm:5200, speed:68, water:62, oil:55, fuel:73 });
  const [lights, setLights] = useState({ breakout:false, buy:false, sell:false, emaCross:false, stop:false, trail:false });

  useEffect(() => {
    const stopG = subscribeGauges(setGauges);
    const stopS = subscribeSignals(setLights);
    return () => { stopG?.(); stopS?.(); };
  }, []);

  return (
    <div className="w-full p-0 md:p-0 space-y-6">

      {/* Ferrari Banner */}
      <div className="relative w-full bg-black text-white p-4 md:p-6 flex items-center justify-between shadow-lg border-b-4 border-red-600">
        <div className="flex items-center gap-3">
          <img src="/ferrari-logo.png" alt="Ferrari Logo" className="h-10 w-auto" />
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-red-600 uppercase">
            Ferrari Trading Dashboard
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <Badge
            variant="secondary"
            className={`text-sm py-1 px-3 rounded-full flex items-center gap-2 ${
              isLive ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
            }`}
          >
            <Activity className="h-4 w-4" /> Mode: {isLive ? "LIVE" : "PAPER"}
          </Badge>
          <Button
            variant="outline"
            onClick={() => setIsLive((v) => !v)}
            className={`bg-white font-semibold rounded-full px-4 py-2 hover:bg-red-50 ${
              isLive ? "text-emerald-600" : "text-red-600"
            }`}
          >
            Switch to {isLive ? "Paper" : "Live"}
          </Button>
        </div>
      </div>

      {/* Ferrari Cluster */}
      <div className="px-4">
        <FerrariCluster
          rpm={gauges.rpm}
          speed={gauges.speed}
          water={gauges.water}
          oil={gauges.oil}
          fuel={gauges.fuel}
          lights={lights}
          height={360}
        />
      </div>

      {/* Environment & Accounts */}
      <Card className="shadow-sm m-4">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2"><Database className="h-5 w-5"/> Environment & Accounts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Primary Account #</Label>
              <Input placeholder="27570747" readOnly/>
            </div>
            <div className="space-y-2">
              <Label>Primary Account Hash</Label>
              <Input placeholder="08BD9C...C15150" readOnly/>
            </div>
            <div className="space-y-2">
              <Label>Auth Status</Label>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-green-500 text-green-600">ok:true</Badge>
                <Button variant="ghost" size="sm" className="gap-2"><RefreshCcw className="h-4 w-4"/>Check</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Config & Risk */}
      <Card className="shadow-sm m-4">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5"/> Configuration & Risk</CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-5 gap-4">
          <div className="space-y-2 md:col-span-1">
            <Label>MAX_ORDER_QTY</Label>
            <Input placeholder="1000"/>
          </div>
          <div className="space-y-2 md:col-span-1">
            <Label>MAX_ORDER_NOTIONAL ($)</Label>
            <Input placeholder="25000"/>
          </div>
          <div className="space-y-2 md:col-span-1">
            <Label>ALLOWED_SYMBOLS</Label>
            <Input placeholder="AAPL, MSFT, SPY"/>
          </div>
          <div className="space-y-2 md:col-span-1">
            <Label>Slippage (bps)</Label>
            <Input placeholder="3"/>
          </div>
          <div className="space-y-2 md:col-span-1">
            <Label>Fill Latency (ms)</Label>
            <Input placeholder="150"/>
          </div>
          <div className="md:col-span-5 flex items-center justify-between rounded-2xl bg-muted p-3">
            <div className="flex items-center gap-2 text-sm"><Shield className="h-4 w-4"/> Live Trading Enabled</div>
            <Switch checked={isLive} onCheckedChange={setIsLive} />
          </div>
          <div className="md:col-span-5 flex gap-3">
            <Button className="rounded-2xl">Save Settings</Button>
            <Button variant="outline" className="rounded-2xl">Reset</Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs (Paper vs Live) */}
      <Tabs defaultValue={isLive ? "live" : "paper"} className="w-full m-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="paper">Paper Trading</TabsTrigger>
          <TabsTrigger value="live">Live (Schwab)</TabsTrigger>
        </TabsList>

        <TabsContent value="paper" className="space-y-4 pt-4">
          <Card>
            <CardHeader><CardTitle>Paper OMS</CardTitle></CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                Paper engine wiring goes here (orders preview, simulated fills, PnL, journal).
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="live" className="space-y-4 pt-4">
          <Card>
            <CardHeader><CardTitle>Live OMS (Schwab)</CardTitle></CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                Live endpoints + risk checks + order tickets here.
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
