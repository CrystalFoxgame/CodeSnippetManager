class SnippetManager {
    constructor() {
        this.snippets = this.loadSnippets();
        this.currentEditId = null;
        this.initializeElements();
        this.attachEventListeners();
        this.renderSnippets();
        this.updateLanguageFilter();
        this.updateTagsList();
    }

    initializeElements() {
        this.snippetsGrid = document.getElementById('snippetsGrid');
        this.modal = document.getElementById('snippetModal');
        this.form = document.getElementById('snippetForm');
        this.searchInput = document.getElementById('searchInput');
        this.languageFilter = document.getElementById('languageFilter');
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
        
        window.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.closeModal();
            }
        });
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
        this.updateTagsList();
        this.closeModal();
    }

    deleteSnippet(id) {
        if (confirm('Are you sure you want to delete this snippet?')) {
            this.snippets = this.snippets.filter(s => s.id !== id);
            this.saveSnippets();
            this.renderSnippets();
            this.updateLanguageFilter();
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
                        <span class="snippet-language">${snippet.language}</span>
                    </div>
                </div>
                ${snippet.description ? `<div class="snippet-description">${this.escapeHtml(snippet.description)}</div>` : ''}
                <div class="snippet-code">${this.escapeHtml(snippet.code)}</div>
                ${snippet.tags.length > 0 ? `
                    <div class="snippet-tags">
                        ${snippet.tags.map(tag => `<span class="snippet-tag">${this.escapeHtml(tag)}</span>`).join('')}
                    </div>
                ` : ''}
                <div class="snippet-actions">
                    <button class="snippet-btn copy-btn" onclick="app.copyToClipboard(\`${this.escapeJs(snippet.code)}\`)">Copy</button>
                    <button class="snippet-btn edit-btn" onclick="app.openModal(${JSON.stringify(snippet).replace(/"/g, '&quot;')})">Edit</button>
                    <button class="snippet-btn delete-btn" onclick="app.deleteSnippet(${snippet.id})">Delete</button>
                </div>
            </div>
        `).join('');
    }

    filterSnippets() {
        const searchTerm = this.searchInput.value.toLowerCase();
        const selectedLanguage = this.languageFilter.value;
        const activeTag = document.querySelector('.tag.active')?.textContent;

        const filtered = this.snippets.filter(snippet => {
            const matchesSearch = !searchTerm || 
                snippet.title.toLowerCase().includes(searchTerm) ||
                snippet.description.toLowerCase().includes(searchTerm) ||
                snippet.code.toLowerCase().includes(searchTerm) ||
                snippet.tags.some(tag => tag.toLowerCase().includes(searchTerm));

            const matchesLanguage = !selectedLanguage || snippet.language === selectedLanguage;
            const matchesTag = !activeTag || snippet.tags.includes(activeTag);

            return matchesSearch && matchesLanguage && matchesTag;
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