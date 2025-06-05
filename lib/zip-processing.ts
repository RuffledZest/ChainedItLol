/**
 * Processes a zip file and converts it to a single HTML file
 */
export async function processZipFile(file: File): Promise<string> {
  try {
    // Import JSZip dynamically to avoid server-side issues
    const JSZip = (await import("jszip")).default

    // Read the zip file
    const zip = await JSZip.loadAsync(file)

    // Extract files from the zip
    const files: Record<string, string> = {}
    const promises: Promise<void>[] = []

    zip.forEach((path, zipEntry) => {
      if (!zipEntry.dir) {
        const promise = zipEntry.async("text").then((content) => {
          files[path] = content
        })
        promises.push(promise)
      }
    })

    await Promise.all(promises)

    // Process the extracted files and convert to a single HTML file
    return await convertToSingleHtml(files)
  } catch (error) {
    console.error("Error processing zip file:", error)
    throw new Error("Failed to process zip file. Please check the file and try again.")
  }
}

async function convertToSingleHtml(files: Record<string, string>): Promise<string> {
  // Find the main HTML file
  const htmlFiles = Object.keys(files).filter((path) => path.endsWith(".html"))
  const mainHtmlFile =
    htmlFiles.find(
      (path) => path.endsWith("index.html") || path.match(/\/index\.html$/) || path.toLowerCase().includes("index"),
    ) || htmlFiles[0]

  if (!mainHtmlFile) {
    // If no HTML file found, create a basic one
    return createBasicHtml(files)
  }

  const htmlContent = files[mainHtmlFile]

  // Parse the HTML to extract head and body content
  const headMatch = htmlContent.match(/<head[^>]*>([\s\S]*?)<\/head>/i)
  const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i)

  let headContent = headMatch ? headMatch[1] : ""
  let bodyContent = bodyMatch ? bodyMatch[1] : htmlContent

  // Process and inline CSS
  headContent = await inlineCssInHtml(headContent, files)
  bodyContent = await inlineCssInHtml(bodyContent, files)

  // Process and inline JavaScript
  headContent = await inlineJsInHtml(headContent, files)
  bodyContent = await inlineJsInHtml(bodyContent, files)

  // Build the final HTML
  let finalHtml = '<!DOCTYPE html>\n<html lang="en">\n<head>\n'
  finalHtml += '  <meta charset="UTF-8">\n'
  finalHtml += '  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n'

  // Extract title if it exists
  const titleMatch = htmlContent.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (titleMatch) {
    finalHtml += `  <title>${titleMatch[1]}</title>\n`
  } else {
    finalHtml += "  <title>Deployed Project</title>\n"
  }

  // Add any remaining CSS files as inline styles
  finalHtml += "  <style>\n"
  Object.entries(files).forEach(([path, content]) => {
    if (path.endsWith(".css") && !headContent.includes(content) && !bodyContent.includes(content)) {
      finalHtml += `/* ${path} */\n${content}\n\n`
    }
  })
  finalHtml += "  </style>\n"

  // Add processed head content (without html, head, body tags)
  const cleanHeadContent = headContent
    .replace(/<\/?html[^>]*>/gi, "")
    .replace(/<\/?head[^>]*>/gi, "")
    .replace(/<\/?body[^>]*>/gi, "")

  finalHtml += cleanHeadContent + "\n"
  finalHtml += "</head>\n<body>\n"

  // Add processed body content
  const cleanBodyContent = bodyContent
    .replace(/<\/?html[^>]*>/gi, "")
    .replace(/<\/?head[^>]*>/gi, "")
    .replace(/<\/?body[^>]*>/gi, "")

  finalHtml += cleanBodyContent + "\n"

  // Add any remaining JavaScript files
  finalHtml += "\n<script>\n"
  Object.entries(files).forEach(([path, content]) => {
    if (
      path.endsWith(".js") &&
      !path.includes("node_modules") &&
      !headContent.includes(content) &&
      !bodyContent.includes(content)
    ) {
      finalHtml += `// ${path}\n${content}\n\n`
    }
  })
  finalHtml += "</script>\n"

  finalHtml += "</body>\n</html>"

  return optimizeHtml(finalHtml)
}

async function inlineCssInHtml(htmlContent: string, files: Record<string, string>): Promise<string> {
  let processedHtml = htmlContent

  // Find all CSS link tags
  const linkRegex = /<link[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi
  let match

  while ((match = linkRegex.exec(htmlContent)) !== null) {
    const href = match[1]
    const fullMatch = match[0]

    // Find the corresponding CSS file
    const cssFile = Object.keys(files).find((path) => {
      const normalizedPath = path.replace(/^[^/]*\//, "") // Remove first directory
      return normalizedPath === href || path.endsWith(href) || path.includes(href.replace("./", ""))
    })

    if (cssFile && files[cssFile]) {
      // Replace the link tag with inline style
      const inlineStyle = `<style>\n/* ${href} */\n${files[cssFile]}\n</style>`
      processedHtml = processedHtml.replace(fullMatch, inlineStyle)
    }
  }

  return processedHtml
}

async function inlineJsInHtml(htmlContent: string, files: Record<string, string>): Promise<string> {
  let processedHtml = htmlContent

  // Find all script tags with src
  const scriptRegex = /<script[^>]*src=["']([^"']+)["'][^>]*><\/script>/gi
  let match

  while ((match = scriptRegex.exec(htmlContent)) !== null) {
    const src = match[1]
    const fullMatch = match[0]

    // Find the corresponding JS file
    const jsFile = Object.keys(files).find((path) => {
      const normalizedPath = path.replace(/^[^/]*\//, "") // Remove first directory
      return normalizedPath === src || path.endsWith(src) || path.includes(src.replace("./", ""))
    })

    if (jsFile && files[jsFile]) {
      // Replace the script tag with inline script
      const inlineScript = `<script>\n// ${src}\n${files[jsFile]}\n</script>`
      processedHtml = processedHtml.replace(fullMatch, inlineScript)
    }
  }

  return processedHtml
}

function createBasicHtml(files: Record<string, string>): string {
  let html = '<!DOCTYPE html>\n<html lang="en">\n<head>\n'
  html += '  <meta charset="UTF-8">\n'
  html += '  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
  html += "  <title>Deployed Project</title>\n"

  // Add CSS
  html += "  <style>\n"
  Object.entries(files).forEach(([path, content]) => {
    if (path.endsWith(".css")) {
      html += `/* ${path} */\n${content}\n\n`
    }
  })
  html += "  </style>\n</head>\n<body>\n"

  // Add a basic structure
  html += '  <div id="app">\n'
  html += "    <h1>Deployed Project</h1>\n"
  html += "    <p>Your project has been deployed successfully!</p>\n"
  html += "  </div>\n\n"

  // Add JavaScript
  html += "  <script>\n"
  Object.entries(files).forEach(([path, content]) => {
    if (path.endsWith(".js") && !path.includes("node_modules")) {
      html += `// ${path}\n${content}\n\n`
    }
  })
  html += "  </script>\n</body>\n</html>"

  return html
}

function identifyProjectType(files: Record<string, string>): string {
  // Check for package.json to identify project type
  const packageJsonFile = Object.keys(files).find((path) => path.endsWith("package.json"))

  if (packageJsonFile) {
    try {
      const packageJson = JSON.parse(files[packageJsonFile])

      if (packageJson.dependencies) {
        if (packageJson.dependencies["next"]) {
          return "nextjs"
        } else if (packageJson.dependencies["react"]) {
          return "react"
        } else if (packageJson.dependencies["vue"]) {
          return "vue"
        }
      }
    } catch (e) {
      console.error("Error parsing package.json:", e)
    }
  }

  // Check for specific files to identify project type
  if (Object.keys(files).some((path) => path.includes("next.config"))) {
    return "nextjs"
  } else if (Object.keys(files).some((path) => path.includes("vite.config"))) {
    return "vite"
  }

  return "static" // Default to static HTML
}

function optimizeHtml(html: string): string {
  // Basic optimization: remove comments, extra whitespace, etc.
  return html
    .replace(/<!--[\s\S]*?-->/g, "") // Remove HTML comments
    .replace(/\/\*[\s\S]*?\*\//g, "") // Remove CSS comments
    .replace(/\/\/.*$/gm, "") // Remove single-line JS comments
    .replace(/\s{2,}/g, " ") // Replace multiple spaces with a single space
    .replace(/>\s+</g, "><") // Remove whitespace between HTML tags
}
