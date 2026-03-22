const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
    });
}

let modifiedFiles = 0;

walkDir(srcDir, function(filePath) {
    if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
        let content = fs.readFileSync(filePath, 'utf8');
        let originalContent = content;
        
        // Remove trailing blue- colors that weren't caught in hex format or weird tailwind strings
        content = content.replace(/border-blue-500/g, 'border-white/20');
        content = content.replace(/bg-blue-500\/50/g, 'bg-white/20');
        content = content.replace(/shadow-blue-500/g, 'shadow-white/10');
        content = content.replace(/accent-blue-500/g, 'accent-white');
        
        // Loader replacements
        let hasSpin = content.includes('animate-spin');
        let hasRefreshCw = content.includes('<RefreshCw');
        
        if (hasSpin && hasRefreshCw && !filePath.endsWith('Loader.tsx')) {
            content = content.replace(/<RefreshCw[^>]*animate-spin[^>]*\/>/g, '<Loader size={20} />');
            
            // If we successfully replaced with <Loader />, ensure it's imported
            if (content.includes('<Loader') && !content.includes('import Loader')) {
                // Find all lucid-react imports to inject after
                const lastLucideImport = content.lastIndexOf('lucide-react\';');
                if (lastLucideImport !== -1) {
                    const insertPos = content.indexOf('\n', lastLucideImport) + 1;
                    content = content.slice(0, insertPos) + "import Loader from '@/components/ui/Loader';\n" + content.slice(insertPos);
                } else {
                    const firstImport = content.indexOf('import ');
                    content = content.slice(0, firstImport) + "import Loader from '@/components/ui/Loader';\n" + content.slice(firstImport);
                }
            }
        }
        
        if (content !== originalContent) {
            fs.writeFileSync(filePath, content, 'utf8');
            modifiedFiles++;
            console.log(`Updated ${path.relative(__dirname, filePath)}`);
        }
    }
});

console.log(`\nFinished! Modified ${modifiedFiles} files.`);
