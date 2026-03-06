const fs = require('fs');
const path = require('path');

const excludeDirs = ['node_modules', '.git', 'dist', 'build', 'public'];
const allowedExts = ['.ts', '.tsx', '.sql', '.json', '.yml', '.yaml', '.md', '.html', '.js', '.cjs'];

function walkAndReplace(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        if (excludeDirs.includes(file)) continue;

        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            walkAndReplace(fullPath);
        } else if (stat.isFile()) {
            const ext = path.extname(fullPath);
            if (allowedExts.includes(ext)) {
                let content = fs.readFileSync(fullPath, 'utf8');
                let newContent = content.replace(/\bomni\b/g, 'altdesk');

                if (content !== newContent) {
                    fs.writeFileSync(fullPath, newContent, 'utf8');
                    console.log(`Updated: ${fullPath}`);
                }
            }
        }
    }
}

walkAndReplace(__dirname);
