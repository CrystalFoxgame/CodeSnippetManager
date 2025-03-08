class SnippetManager {
    constructor() {
        this.snippets = this.loadSnippets();
        this.currentEditId = null;
        this.initializeElements();
        this.attachEventListeners();
        this.setupKeyboardShortcuts();
        this.setupAutoBackup();
        this.renderSnippets();
        this.updateLanguageFilter();
        this.updateCategoryFilter();
        this.updateTagsList();
    }

    initializeElements() {
        this.snippetsGrid = document.getElementById('snippetsGrid');
        this.modal = document.getElementById('snippetModal');
        this.form = document.getElementById('snippetForm');
        this.searchInput = document.getElementById('searchInput');
        this.languageFilter = document.getElementById('languageFilter');
        this.categoryFilter = document.getElementById('categoryFilter');
        this.tagsList = document.getElementById('tagsList');
    }

    attachEventListeners() {
        document.getElementById('newSnippetBtn').addEventListener('click', () => this.openModal());
        document.getElementById('exportBtn').addEventListener('click', () => this.exportSnippets());
        document.getElementById('importBtn').addEventListener('click', () => this.importSnippets());
        document.getElementById('importFile').addEventListener('change', (e) => this.handleFileImport(e));
        
        document.querySelector('.close').addEventListener('click', () => this.closeModal());
        document.getElementById('cancelBtn').addEventListener('click', () => this.closeModal());
        
        this.form.addEventListener('submit', (e) => this.saveSnippet(e));
        this.searchInput.addEventListener('input', () => this.filterSnippets());
        this.languageFilter.addEventListener('change', () => this.filterSnippets());
        this.categoryFilter.addEventListener('change', () => this.filterSnippets());
        
        window.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.closeModal();
            }
        });

        // Code formatting buttons
        document.addEventListener('click', (e) => {
            if (e.target.id === 'formatCodeBtn') {
                this.formatCode();
            } else if (e.target.id === 'minifyCodeBtn') {
                this.minifyCode();
            }
        });
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ignore shortcuts when typing in inputs
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
                return;
            }

            // Ignore shortcuts when modal is not open (except for opening shortcuts)
            const isModalOpen = this.modal.style.display === 'block';

            if (e.ctrlKey || e.metaKey) {
                switch (e.key.toLowerCase()) {
                    case 'n':
                        e.preventDefault();
                        this.openModal();
                        break;
                    case 'f':
                        e.preventDefault();
                        this.searchInput.focus();
                        break;
                    case 's':
                        e.preventDefault();
                        if (isModalOpen) {
                            this.form.dispatchEvent(new Event('submit'));
                        } else {
                            this.exportSnippets();
                        }
                        break;
                    case 'o':
                        e.preventDefault();
                        this.importSnippets();
                        break;
                }
            } else if (e.key === 'Escape') {
                if (isModalOpen) {
                    this.closeModal();
                }
                // Clear search and filters
                this.searchInput.value = '';
                this.languageFilter.value = '';
                this.categoryFilter.value = '';
                document.querySelectorAll('.tag.active').forEach(tag => tag.classList.remove('active'));
                this.filterSnippets();
            } else if (e.key === '/') {
                e.preventDefault();
                this.searchInput.focus();
            }
        });

        // Show keyboard shortcuts help
        this.showKeyboardShortcutsHint();
    }

    showKeyboardShortcutsHint() {
        // Add help text to the page
        const helpText = document.createElement('div');
        helpText.id = 'keyboard-help';
        helpText.innerHTML = `
            <small style="color: #666; font-size: 11px;">
                Shortcuts: Ctrl+N (New), Ctrl+F (Search), / (Search), Ctrl+S (Save/Export), Ctrl+O (Import), Esc (Close/Clear)
            </small>
        `;
        helpText.style.cssText = `
            position: fixed;
            bottom: 10px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(255,255,255,0.9);
            padding: 8px 15px;
            border-radius: 15px;
            border: 1px solid #e0e0e0;
            backdrop-filter: blur(5px);
            z-index: 999;
            opacity: 0;
            transition: opacity 0.3s;
            pointer-events: none;
        `;
        
        document.body.appendChild(helpText);
        
        // Show help on first visit
        if (!localStorage.getItem('keyboardHelpShown')) {
            setTimeout(() => {
                helpText.style.opacity = '1';
                setTimeout(() => {
                    helpText.style.opacity = '0';
                }, 5000);
            }, 1000);
            localStorage.setItem('keyboardHelpShown', 'true');
        }

        // Show help on hover over header
        const header = document.querySelector('header');
        header.addEventListener('mouseenter', () => {
            helpText.style.opacity = '1';
        });
        header.addEventListener('mouseleave', () => {
            helpText.style.opacity = '0';
        });
    }

    setupAutoBackup() {
        // Auto-backup every 5 minutes
        setInterval(() => {
            this.createAutoBackup();
        }, 5 * 60 * 1000);

        // Backup on page unload
        window.addEventListener('beforeunload', () => {
            this.createAutoBackup();
        });

        // Show backup status in UI
        this.showBackupStatus();
    }

    createAutoBackup() {
        if (this.snippets.length === 0) return;

        const backup = {
            timestamp: new Date().toISOString(),
            snippets: this.snippets,
            version: '1.0'
        };

        // Keep last 5 auto-backups
        let backups = JSON.parse(localStorage.getItem('autoBackups') || '[]');
        backups.push(backup);
        
        if (backups.length > 5) {
            backups = backups.slice(-5);
        }

        localStorage.setItem('autoBackups', JSON.stringify(backups));
        localStorage.setItem('lastBackupTime', new Date().toISOString());
        
        this.updateBackupStatus();
    }

    showBackupStatus() {
        const backupStatus = document.createElement('div');
        backupStatus.id = 'backup-status';
        backupStatus.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(0,0,0,0.7);
            color: white;
            padding: 8px 12px;
            border-radius: 20px;
            font-size: 11px;
            z-index: 1000;
            opacity: 0;
            transition: opacity 0.3s;
            cursor: pointer;
        `;
        
        backupStatus.addEventListener('click', () => {
            this.showBackupManager();
        });

        document.body.appendChild(backupStatus);
        this.updateBackupStatus();
    }

    updateBackupStatus() {
        const statusEl = document.getElementById('backup-status');
        if (!statusEl) return;

        const lastBackup = localStorage.getItem('lastBackupTime');
        if (lastBackup) {
            const timeDiff = Date.now() - new Date(lastBackup).getTime();
            const minutes = Math.floor(timeDiff / (1000 * 60));
            
            if (minutes < 1) {
                statusEl.textContent = '💾 Backed up just now';
                statusEl.style.background = 'rgba(34, 197, 94, 0.8)';
            } else if (minutes < 60) {
                statusEl.textContent = `💾 Backed up ${minutes}m ago`;
                statusEl.style.background = 'rgba(34, 197, 94, 0.8)';
            } else {
                statusEl.textContent = `💾 Backed up ${Math.floor(minutes/60)}h ago`;
                statusEl.style.background = 'rgba(249, 115, 22, 0.8)';
            }
            
            statusEl.style.opacity = '1';
        } else {
            statusEl.textContent = '💾 No backups yet';
            statusEl.style.background = 'rgba(239, 68, 68, 0.8)';
            statusEl.style.opacity = '1';
        }
    }

    showBackupManager() {
        const backups = JSON.parse(localStorage.getItem('autoBackups') || '[]');
        
        if (backups.length === 0) {
            alert('No backups available yet. Auto-backup runs every 5 minutes.');
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'block';
        
        const backupList = backups.map((backup, index) => {
            const date = new Date(backup.timestamp);
            return `
                <div style="padding: 10px; border: 1px solid #ddd; margin: 5px 0; border-radius: 5px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong>${date.toLocaleDateString()} ${date.toLocaleTimeString()}</strong><br>
                        <small>${backup.snippets.length} snippets</small>
                    </div>
                    <button onclick="app.restoreBackup(${index})" class="btn" style="background: #3742fa; color: white;">Restore</button>
                </div>
            `;
        }).join('');

        modal.innerHTML = `
            <div class="modal-content">
                <span class="close" onclick="document.body.removeChild(this.closest('.modal'))">&times;</span>
                <h2>Backup Manager</h2>
                <p>Auto-backups are created every 5 minutes and when you close the page.</p>
                ${backupList}
                <div style="margin-top: 20px; text-align: right;">
                    <button onclick="document.body.removeChild(this.closest('.modal'))" class="btn">Close</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    restoreBackup(index) {
        const backups = JSON.parse(localStorage.getItem('autoBackups') || '[]');
        if (backups[index] && confirm('This will replace all current snippets. Continue?')) {
            this.snippets = backups[index].snippets;
            this.saveSnippets();
            this.renderSnippets();
            this.updateLanguageFilter();
            this.updateCategoryFilter();
            this.updateTagsList();
            document.body.removeChild(document.querySelector('.modal'));
            this.showToast('Backup restored successfully!');
        }
    }

    loadSnippets() {
        const stored = localStorage.getItem('codeSnippets');
        return stored ? JSON.parse(stored) : [];
    }

    saveSnippets() {
        localStorage.setItem('codeSnippets', JSON.stringify(this.snippets));
    }

    openModal(snippet = null) {
        if (snippet) {
            this.currentEditId = snippet.id;
            document.getElementById('modalTitle').textContent = 'Edit Snippet';
            document.getElementById('snippetTitle').value = snippet.title;
            document.getElementById('snippetLanguage').value = snippet.language;
            document.getElementById('snippetCategory').value = snippet.category || '';
            document.getElementById('customCategory').value = '';
            document.getElementById('snippetTags').value = snippet.tags.join(', ');
            document.getElementById('snippetDescription').value = snippet.description;
            document.getElementById('snippetCode').value = snippet.code;
        } else {
            this.currentEditId = null;
            document.getElementById('modalTitle').textContent = 'New Snippet';
            this.form.reset();
        }
        this.modal.style.display = 'block';
    }

    closeModal() {
        this.modal.style.display = 'none';
        this.currentEditId = null;
        this.form.reset();
    }

    saveSnippet(e) {
        e.preventDefault();
        
        const title = document.getElementById('snippetTitle').value.trim();
        const language = document.getElementById('snippetLanguage').value;
        const category = document.getElementById('customCategory').value.trim() || 
                        document.getElementById('snippetCategory').value;
        const tags = document.getElementById('snippetTags').value
            .split(',')
            .map(tag => tag.trim())
            .filter(tag => tag);
        const description = document.getElementById('snippetDescription').value.trim();
        const code = document.getElementById('snippetCode').value.trim();
        
        if (!title || !code) {
            alert('Title and code are required!');
            return;
        }

        const snippet = {
            id: this.currentEditId || Date.now(),
            title,
            language,
            category,
            tags,
            description,
            code,
            createdAt: this.currentEditId ? 
                this.snippets.find(s => s.id === this.currentEditId).createdAt : 
                new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        if (this.currentEditId) {
            const index = this.snippets.findIndex(s => s.id === this.currentEditId);
            this.snippets[index] = snippet;
        } else {
            this.snippets.unshift(snippet);
        }

        this.saveSnippets();
        this.renderSnippets();
        this.updateLanguageFilter();
        this.updateCategoryFilter();
        this.updateTagsList();
        this.closeModal();
    }

    deleteSnippet(id) {
        if (confirm('Are you sure you want to delete this snippet?')) {
            this.snippets = this.snippets.filter(s => s.id !== id);
            this.saveSnippets();
            this.renderSnippets();
            this.updateLanguageFilter();
            this.updateCategoryFilter();
            this.updateTagsList();
        }
    }

    copyToClipboard(code) {
        navigator.clipboard.writeText(code).then(() => {
            this.showToast('Code copied to clipboard!');
        }).catch(err => {
            console.error('Failed to copy: ', err);
        });
    }

    exportSingleSnippet(id) {
        const snippet = this.snippets.find(s => s.id === id);
        if (!snippet) return;

        const fileExtensions = {
            javascript: 'js',
            python: 'py',
            html: 'html',
            css: 'css',
            java: 'java',
            cpp: 'cpp',
            c: 'c',
            php: 'php',
            go: 'go',
            rust: 'rs',
            sql: 'sql',
            bash: 'sh',
            json: 'json',
            typescript: 'ts'
        };

        const extension = fileExtensions[snippet.language] || 'txt';
        const filename = `${snippet.title.replace(/[^a-zA-Z0-9]/g, '_')}.${extension}`;
        
        const content = `/*
 * ${snippet.title}
 * ${snippet.description || 'No description'}
 * Language: ${snippet.language}
 * Tags: ${snippet.tags.join(', ')}
 * Created: ${new Date(snippet.createdAt).toLocaleDateString()}
 */

${snippet.code}`;

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showToast('Snippet exported as ' + filename);
    }

    showToast(message) {
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #2d3748;
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            z-index: 1001;
        `;
        document.body.appendChild(toast);
        setTimeout(() => document.body.removeChild(toast), 2000);
    }

    formatCode() {
        const codeTextarea = document.getElementById('snippetCode');
        const language = document.getElementById('snippetLanguage').value;
        let code = codeTextarea.value;

        try {
            if (language === 'javascript' || language === 'js') {
                // Basic JS formatting
                code = this.formatJavaScript(code);
            } else if (language === 'json') {
                // Format JSON
                code = JSON.stringify(JSON.parse(code), null, 2);
            } else if (language === 'css') {
                // Basic CSS formatting
                code = this.formatCSS(code);
            } else {
                // Generic formatting (add proper indentation)
                code = this.formatGeneric(code);
            }
            
            codeTextarea.value = code;
            this.showToast('Code formatted successfully!');
        } catch (error) {
            this.showToast('Could not format code: ' + error.message);
        }
    }

    minifyCode() {
        const codeTextarea = document.getElementById('snippetCode');
        const language = document.getElementById('snippetLanguage').value;
        let code = codeTextarea.value;

        try {
            if (language === 'javascript' || language === 'js') {
                // Basic minification
                code = code.replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
                           .replace(/\/\/.*$/gm, '') // Remove single line comments
                           .replace(/\s+/g, ' ') // Replace multiple spaces
                           .trim();
            } else if (language === 'css') {
                // Basic CSS minification
                code = code.replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
                           .replace(/\s+/g, ' ')
                           .replace(/; /g, ';')
                           .replace(/ {/g, '{')
                           .replace(/} /g, '}')
                           .trim();
            } else if (language === 'json') {
                // Minify JSON
                code = JSON.stringify(JSON.parse(code));
            }
            
            codeTextarea.value = code;
            this.showToast('Code minified successfully!');
        } catch (error) {
            this.showToast('Could not minify code: ' + error.message);
        }
    }

    formatJavaScript(code) {
        return code.replace(/;/g, ';\n')
                   .replace(/{/g, ' {\n')
                   .replace(/}/g, '\n}')
                   .replace(/,/g, ',\n')
                   .split('\n')
                   .map(line => line.trim())
                   .filter(line => line.length > 0)
                   .join('\n');
    }

    formatCSS(code) {
        return code.replace(/{/g, ' {\n')
                   .replace(/}/g, '\n}\n')
                   .replace(/;/g, ';\n')
                   .split('\n')
                   .map(line => line.trim())
                   .filter(line => line.length > 0)
                   .join('\n');
    }

    formatGeneric(code) {
        // Simple generic formatting - fix basic indentation
        return code.split('\n')
                   .map(line => line.trim())
                   .join('\n');
    }

    renderSnippets(filteredSnippets = null) {
        const snippetsToRender = filteredSnippets || this.snippets;
        
        if (snippetsToRender.length === 0) {
            this.snippetsGrid.innerHTML = `
                <div class="empty-state">
                    <p>${filteredSnippets ? 'No snippets match your search.' : 'No snippets yet. Create your first one!'}</p>
                </div>
            `;
            return;
        }

        this.snippetsGrid.innerHTML = snippetsToRender.map(snippet => `
            <div class="snippet-card">
                <div class="snippet-header">
                    <div>
                        <div class="snippet-title">${this.escapeHtml(snippet.title)}</div>
                        <div class="snippet-meta">
                            <span class="snippet-language">${snippet.language}</span>
                            ${snippet.category ? `<span class="snippet-category">${this.escapeHtml(snippet.category)}</span>` : ''}
                        </div>
                    </div>
                </div>
                ${snippet.description ? `<div class="snippet-description">${this.escapeHtml(snippet.description)}</div>` : ''}
                <div class="snippet-code"><pre><code class="language-${snippet.language}">${this.escapeHtml(snippet.code)}</code></pre></div>
                ${snippet.tags.length > 0 ? `
                    <div class="snippet-tags">
                        ${snippet.tags.map(tag => `<span class="snippet-tag">${this.escapeHtml(tag)}</span>`).join('')}
                    </div>
                ` : ''}
                <div class="snippet-actions">
                    <button class="snippet-btn copy-btn" onclick="app.copyToClipboard(\`${this.escapeJs(snippet.code)}\`)">Copy</button>
                    <button class="snippet-btn export-btn" onclick="app.exportSingleSnippet(${snippet.id})">Export</button>
                    <button class="snippet-btn edit-btn" onclick="app.openModal(${JSON.stringify(snippet).replace(/"/g, '&quot;')})">Edit</button>
                    <button class="snippet-btn delete-btn" onclick="app.deleteSnippet(${snippet.id})">Delete</button>
                </div>
            </div>
        `).join('');
        
        // Apply syntax highlighting
        if (window.Prism) {
            window.Prism.highlightAll();
        }
    }

    filterSnippets() {
        const searchTerm = this.searchInput.value.toLowerCase();
        const selectedLanguage = this.languageFilter.value;
        const selectedCategory = this.categoryFilter.value;
        const activeTag = document.querySelector('.tag.active')?.textContent;

        const filtered = this.snippets.filter(snippet => {
            const matchesSearch = !searchTerm || 
                snippet.title.toLowerCase().includes(searchTerm) ||
                snippet.description.toLowerCase().includes(searchTerm) ||
                snippet.code.toLowerCase().includes(searchTerm) ||
                snippet.tags.some(tag => tag.toLowerCase().includes(searchTerm)) ||
                (snippet.category && snippet.category.toLowerCase().includes(searchTerm));

            const matchesLanguage = !selectedLanguage || snippet.language === selectedLanguage;
            const matchesCategory = !selectedCategory || snippet.category === selectedCategory;
            const matchesTag = !activeTag || snippet.tags.includes(activeTag);

            return matchesSearch && matchesLanguage && matchesCategory && matchesTag;
        });

        this.renderSnippets(filtered);
    }

    updateLanguageFilter() {
        const languages = [...new Set(this.snippets.map(s => s.language))].sort();
        const currentValue = this.languageFilter.value;
        
        this.languageFilter.innerHTML = '<option value="">All Languages</option>' +
            languages.map(lang => `<option value="${lang}">${lang.charAt(0).toUpperCase() + lang.slice(1)}</option>`).join('');
        
        this.languageFilter.value = currentValue;
    }

    updateCategoryFilter() {
        const categories = [...new Set(this.snippets.map(s => s.category).filter(c => c))].sort();
        const currentValue = this.categoryFilter.value;
        
        this.categoryFilter.innerHTML = '<option value="">All Categories</option>' +
            categories.map(cat => `<option value="${cat}">${cat.charAt(0).toUpperCase() + cat.slice(1)}</option>`).join('');
        
        this.categoryFilter.value = currentValue;
    }

    updateTagsList() {
        const allTags = [...new Set(this.snippets.flatMap(s => s.tags))].sort();
        
        this.tagsList.innerHTML = allTags.map(tag => 
            `<span class="tag" onclick="app.toggleTag(this)">${this.escapeHtml(tag)}</span>`
        ).join('');
    }

    toggleTag(tagElement) {
        document.querySelectorAll('.tag').forEach(tag => tag.classList.remove('active'));
        
        if (tagElement.classList.contains('active')) {
            tagElement.classList.remove('active');
        } else {
            tagElement.classList.add('active');
        }
        
        this.filterSnippets();
    }

    exportSnippets() {
        const dataStr = JSON.stringify(this.snippets, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `code-snippets-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        URL.revokeObjectURL(url);
    }

    importSnippets() {
        document.getElementById('importFile').click();
    }

    handleFileImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedSnippets = JSON.parse(e.target.result);
                
                if (!Array.isArray(importedSnippets)) {
                    throw new Error('Invalid file format');
                }

                const validSnippets = importedSnippets.filter(snippet => 
                    snippet.title && snippet.code && snippet.id
                );

                if (validSnippets.length === 0) {
                    alert('No valid snippets found in the file.');
                    return;
                }

                const mergedSnippets = [...validSnippets, ...this.snippets];
                const uniqueSnippets = mergedSnippets.filter((snippet, index, array) =>
                    index === array.findIndex(s => s.id === snippet.id)
                );

                this.snippets = uniqueSnippets.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                this.saveSnippets();
                this.renderSnippets();
                this.updateLanguageFilter();
                this.updateTagsList();
                
                this.showToast(`Imported ${validSnippets.length} snippets successfully!`);
            } catch (error) {
                alert('Error importing file: Invalid format');
            }
        };
        
        reader.readAsText(file);
        event.target.value = '';
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    escapeJs(text) {
        return text.replace(/`/g, '\\`').replace(/\$/g, '\\$');
    }
}

const app = new SnippetManager();