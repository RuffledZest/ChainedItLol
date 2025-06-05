/**
 * Processes a GitHub repository URL and converts it to a single HTML file
 */
import { processZipFile } from "./zip-processing" // Import the processZipFile function

export async function processGithubRepo(url: string): Promise<string> {
  // Validate GitHub URL
  if (!isValidGithubUrl(url)) {
    throw new Error("Invalid GitHub repository URL")
  }

  try {
    // Extract owner and repo from URL
    const { owner, repo } = extractRepoInfo(url)

    // Fetch repository contents
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/zipball`
    const response = await fetch(apiUrl)

    if (!response.ok) {
      throw new Error(`Failed to fetch repository: ${response.statusText}`)
    }

    // Get the zip file as blob
    const blob = await response.blob()

    // Convert blob to File object for processing
    const file = new File([blob], `${repo}.zip`, { type: "application/zip" })

    // Use the zip processing function to handle the rest
    return await processZipFile(file)
  } catch (error) {
    console.error("Error processing GitHub repository:", error)
    throw new Error("Failed to process GitHub repository. Please check the URL and try again.")
  }
}

function isValidGithubUrl(url: string): boolean {
  // Basic validation for GitHub URLs
  const githubRegex = /^https?:\/\/github\.com\/[^/]+\/[^/]+/
  return githubRegex.test(url)
}

function extractRepoInfo(url: string): { owner: string; repo: string } {
  // Remove trailing slash if present
  const cleanUrl = url.replace(/\/$/, "")

  // Extract owner and repo from URL
  const parts = cleanUrl.split("/")
  const owner = parts[parts.length - 2]
  const repo = parts[parts.length - 1].split("#")[0].split("?")[0]

  return { owner, repo }
}
