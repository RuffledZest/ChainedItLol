"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Loader2, Wallet, ExternalLink, Copy, CheckCircle, AlertCircle } from "lucide-react"
import { ShineBorder } from "@/components/magicui/shine-border"
import ParticlesBackground from "@/components/ardacity/particles-background"
import { connectWallet, getWalletAddress, getArnsNames, migrateToArns } from "@/lib/arns-utils"

interface ArnsName {
  name: string
  processId: string
  undername?: string
}

export default function ArnsPage() {
  const [walletConnected, setWalletConnected] = useState(false)
  const [walletAddress, setWalletAddress] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)
  const [arnsNames, setArnsNames] = useState<ArnsName[]>([])
  const [selectedArns, setSelectedArns] = useState<string>("")
  const [arweaveUrl, setArweaveUrl] = useState("")
  const [migrationResult, setMigrationResult] = useState<string>("")
  const [error, setError] = useState<string | null>(null)
  const [isLoadingArns, setIsLoadingArns] = useState(false)
  const [isMigrating, setIsMigrating] = useState(false)

  useEffect(() => {
    checkWalletConnection()
  }, [])

  const checkWalletConnection = async () => {
    try {
      const address = await getWalletAddress()
      if (address) {
        setWalletAddress(address)
        setWalletConnected(true)
      }
    } catch (error) {
      console.log("No wallet connected")
    }
  }

  const handleConnectWallet = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const address = await connectWallet()
      setWalletAddress(address)
      setWalletConnected(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect wallet")
    } finally {
      setIsLoading(false)
    }
  }

  const handleFetchArnsNames = async () => {
    if (!walletAddress) return
    
    setIsLoadingArns(true)
    setError(null)
    
    try {
      const names = await getArnsNames(walletAddress)
      setArnsNames(names)
      if (names.length === 0) {
        setError("No ARNS names found for this wallet address")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch ARNS names")
    } finally {
      setIsLoadingArns(false)
    }
  }

  const handleMigration = async () => {
    if (!selectedArns || !arweaveUrl) {
      setError("Please select an ARNS name and enter an Arweave URL")
      return
    }

    // Validate Arweave URL
    const arweaveRegex = /^https:\/\/[a-zA-Z0-9_-]+\.arweave\.net\/[a-zA-Z0-9_-]+$/
    if (!arweaveRegex.test(arweaveUrl)) {
      setError("Please enter a valid arweave.net URL (e.g., https://example.arweave.net/txId)")
      return
    }

    setIsMigrating(true)
    setError(null)
    setMigrationResult("")

    try {
      const selectedArnsData = arnsNames.find(arns => arns.name === selectedArns)
      if (!selectedArnsData) {
        throw new Error("Selected ARNS name not found")
      }

      const result = await migrateToArns(
        selectedArnsData.processId,
        selectedArnsData.undername || "@",
        arweaveUrl
      )

      setMigrationResult(result.arnsUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Migration failed")
    } finally {
      setIsMigrating(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const extractTxId = (url: string): string => {
    const match = url.match(/\/([a-zA-Z0-9_-]+)$/)
    return match ? match[1] : ""
  }

  return (
    <main className="container max-w-4xl mx-auto py-10 px-4">
      <ParticlesBackground className="absolute inset-0 z-[-1]" />
      
      <div className="relative flex flex-col items-center text-center mb-10">
        <h1 className="text-4xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-b from-black to-black/70 dark:from-white dark:to-white/70">
          ARNS Migration Tool
        </h1>
        <p className="text-gray-500 max-w-xl bg-clip-text text-transparent bg-gradient-to-b from-black/90 to-black/50 dark:from-white/90 dark:to-white/50">
          Connect your wallet, select an ARNS name, and migrate your Arweave content to a custom domain
        </p>
      </div>

      <div className="space-y-6 mt-28">
        {/* Wallet Connection */}
        <Card className="relative overflow-hidden">
          <ShineBorder shineColor={"white"} />
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Wallet Connection
            </CardTitle>
            <CardDescription>
              Connect your Arweave wallet to access your ARNS names
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!walletConnected ? (
              <Button onClick={handleConnectWallet} disabled={isLoading} className="w-full">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Wallet className="mr-2 h-4 w-4" />
                    Connect Wallet
                  </>
                )}
              </Button>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium">Wallet Connected</span>
                  </div>
                  <Badge variant="secondary" className="font-mono text-xs">
                    {walletAddress.slice(0, 8)}...{walletAddress.slice(-8)}
                  </Badge>
                </div>
                
                <Button 
                  onClick={handleFetchArnsNames} 
                  disabled={isLoadingArns}
                  className="w-full"
                  variant="outline"
                >
                  {isLoadingArns ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Fetching ARNS Names...
                    </>
                  ) : (
                    "Fetch My ARNS Names"
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ARNS Names Display */}
        {arnsNames.length > 0 && (
          <Card className="relative overflow-hidden">
            <ShineBorder shineColor={"white"} />
            <CardHeader>
              <CardTitle>Your ARNS Names</CardTitle>
              <CardDescription>
                Found {arnsNames.length} ARNS name{arnsNames.length !== 1 ? 's' : ''} associated with your wallet
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {arnsNames.map((arns, index) => (
                  <div 
                    key={index}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{arns.name}</span>
                      <span className="text-sm text-muted-foreground font-mono">
                        {arns.processId.slice(0, 12)}...{arns.processId.slice(-12)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {arns.undername || "@"}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(arns.processId)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Migration Form */}
        {arnsNames.length > 0 && (
          <Card className="relative overflow-hidden">
            <ShineBorder shineColor={"white"} />
            <CardHeader>
              <CardTitle>Migrate to ARNS</CardTitle>
              <CardDescription>
                Select an ARNS name and provide the Arweave URL you want to migrate
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Select ARNS Name</label>
                <Select value={selectedArns} onValueChange={setSelectedArns}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an ARNS name" />
                  </SelectTrigger>
                  <SelectContent>
                    {arnsNames.map((arns, index) => (
                      <SelectItem key={index} value={arns.name}>
                        {arns.name} ({arns.undername || "@"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Arweave URL</label>
                <Input
                  placeholder="https://example.arweave.net/transaction-id"
                  value={arweaveUrl}
                  onChange={(e) => setArweaveUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Enter the full arweave.net URL you want to migrate to your ARNS domain
                </p>
              </div>

              <Button 
                onClick={handleMigration} 
                disabled={isMigrating || !selectedArns || !arweaveUrl}
                className="w-full"
              >
                {isMigrating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Migrating...
                  </>
                ) : (
                  "Migrate to ARNS"
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Migration Result */}
        {migrationResult && (
          <Card className="relative overflow-hidden border-green-200 dark:border-green-800">
            <ShineBorder shineColor={"green"} />
            <CardHeader>
              <CardTitle className="text-green-700 dark:text-green-300">Migration Successful!</CardTitle>
              <CardDescription>
                Your content is now accessible via your ARNS domain
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-green-700 dark:text-green-300">
                        New ARNS URL:
                      </span>
                      <span className="font-mono text-sm break-all">
                        {migrationResult}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(migrationResult)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                      >
                        <a href={migrationResult} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>
                
                <div className="text-sm text-muted-foreground">
                  <p>✅ Transaction ID: {extractTxId(arweaveUrl)}</p>
                  <p>✅ ARNS Name: {selectedArns}</p>
                  <p>✅ Migration completed successfully</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
    </main>
  )
}