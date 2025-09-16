const fs = require('fs')
const path = require('path')

function getEnvVar(name) {
  try {
    const envPath = path.join(process.cwd(), '.env.local')
    if (!fs.existsSync(envPath)) {
      return null
    }
    
    const envContent = fs.readFileSync(envPath, 'utf8')
    const match = envContent.match(new RegExp(`^${name}="?([^"\\n]+)"?$`, "m"))
    return match ? match[1] : null
  } catch (error) {
    return null
  }
}

module.exports = { getEnvVar }
