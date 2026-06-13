import React, { useState, useEffect, useMemo, useRef } from 'react';
import { usePageMeta } from '@/hooks/usePageMeta';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Bookmark, Upload, Sparkles, Search, Trash2, Edit,
    ExternalLink, Globe, Star, AlertTriangle, Clock, RefreshCw, X,
    Folder, CheckSquare, Square, Tag, ArrowUpDown, ChevronDown, Check, ArrowUp,
    Briefcase, Code, Palette, Users, FileText, Tv,
    Book, Laptop, Settings, Link, Heart, Smile, Compass, HelpCircle
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { bookmarksService, type Bookmark as BookmarkType } from '@/services/bookmarks.service';
import Select from '@/components/ui/Select';
import Modal from '@/components/ui/Modal';

const DEFAULT_CATEGORIES = ['Learning', 'Career', 'Developer Tools', 'Design Assets', 'Productivity & Utilities', 'Social & Community', 'News & Blogs', 'Entertainment & Media', 'General'];

export const ICON_MAP: Record<string, React.ComponentType<any>> = {
    Star,
    Briefcase,
    Code,
    Palette,
    Clock,
    Users,
    FileText,
    Tv,
    Folder,
    Bookmark,
    Sparkles,
    Globe,
    Book,
    Laptop,
    Settings,
    Link,
    Heart,
    Smile,
    Compass,
    HelpCircle
};

const DEFAULT_METAS: Record<string, { icon: string; color: string; badge: string }> = {
    'Learning': { icon: 'Star', color: 'hover:bg-blue-500/5 hover:text-blue-500', badge: 'bg-blue-500/5 text-blue-500 border-blue-500/15' },
    'Career': { icon: 'Briefcase', color: 'hover:bg-emerald-500/5 hover:text-emerald-500', badge: 'bg-emerald-500/5 text-emerald-500 border-emerald-500/15' },
    'Developer Tools': { icon: 'Code', color: 'hover:bg-amber-500/5 hover:text-amber-500', badge: 'bg-amber-500/5 text-amber-500 border-amber-500/15' },
    'Design Assets': { icon: 'Palette', color: 'hover:bg-rose-500/5 hover:text-rose-500', badge: 'bg-rose-500/5 text-rose-500 border-rose-500/15' },
    'Productivity & Utilities': { icon: 'Clock', color: 'hover:bg-teal-500/5 hover:text-teal-500', badge: 'bg-teal-500/5 text-teal-500 border-teal-500/15' },
    'Social & Community': { icon: 'Users', color: 'hover:bg-purple-500/5 hover:text-purple-500', badge: 'bg-purple-500/5 text-purple-500 border-purple-500/15' },
    'News & Blogs': { icon: 'FileText', color: 'hover:bg-cyan-500/5 hover:text-cyan-500', badge: 'bg-cyan-500/5 text-cyan-500 border-cyan-500/15' },
    'Entertainment & Media': { icon: 'Tv', color: 'hover:bg-indigo-500/5 hover:text-indigo-500', badge: 'bg-indigo-500/5 text-indigo-500 border-indigo-500/15' },
    'General': { icon: 'Folder', color: 'hover:bg-slate-500/5 hover:text-slate-500', badge: 'bg-slate-500/5 text-slate-500 border-slate-500/15' }
};

const getCategoryMeta = (name: string, customIcons: Record<string, string> = {}) => {
    const customIconName = customIcons[name];
    const defaultMeta = DEFAULT_METAS[name] || { icon: 'Folder', color: 'hover:bg-slate-500/5 hover:text-slate-500', badge: 'bg-slate-500/5 text-slate-500 border-slate-500/15' };
    
    const iconName = customIconName || defaultMeta.icon;
    const IconComp = ICON_MAP[iconName] || Folder;
    
    return {
        icon: IconComp,
        iconName: iconName,
        color: defaultMeta.color,
        badge: defaultMeta.badge
    };
};

const Bookmarks: React.FC = () => {
    usePageMeta({ 
        title: 'Bookmarks Manager | Zenith',
        description: 'AI-Powered student and developer resource bookmarks organizer.'
    });
    const { showToast } = useToast();

    // Data State
    const [bookmarks, setBookmarks] = useState<BookmarkType[]>([]);
    const [loading, setLoading] = useState(true);

    // Filter & Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('All'); // 'All', 'Recently Used', 'Duplicates', preset categories...
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [sortBy, setSortBy] = useState<'created_at' | 'click_count' | 'priority' | 'title'>('created_at');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    // UI Interaction State
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isEditing, setIsEditing] = useState<BookmarkType | null>(null);

    // AI Enrichment State
    const [aiEnriching, setAiEnriching] = useState(false);
    const [aiProgress, setAiProgress] = useState({ current: 0, total: 0 });

    // Custom Dropdown & Edit States
    const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
    const sortDropdownRef = useRef<HTMLDivElement>(null);
    const [editCategory, setEditCategory] = useState<string>('');
    const [editPriority, setEditPriority] = useState<number>(0);

    // Custom Category Icons & Rename States
    const [customIcons, setCustomIcons] = useState<Record<string, string>>(() => {
        try {
            const saved = localStorage.getItem('zenith_bookmark_category_icons');
            return saved ? JSON.parse(saved) : {};
        } catch {
            return {};
        }
    });
    const [isEditingCategory, setIsEditingCategory] = useState<string | null>(null);

    const handleRenameCategory = async (oldName: string, newName: string, selectedIconName: string) => {
        try {
            const trimmedNewName = newName.trim();
            if (!trimmedNewName) {
                showToast('error', 'Category name cannot be empty');
                return;
            }

            if (oldName !== trimmedNewName) {
                const { count } = await bookmarksService.renameCategory(oldName, trimmedNewName);
                // Update local bookmarks categories
                setBookmarks(prev => prev.map(b => b.category === oldName ? { ...b, category: trimmedNewName } : b));
                if (selectedCategory === oldName) {
                    setSelectedCategory(trimmedNewName);
                }
                showToast('success', `Renamed category and updated ${count} bookmarks!`);
            } else {
                showToast('success', 'Category settings updated successfully!');
            }
            
            // Save the custom icon selection to state and localStorage
            const nextIcons = { ...customIcons };
            if (oldName !== trimmedNewName) {
                delete nextIcons[oldName];
            }
            nextIcons[trimmedNewName] = selectedIconName;
            setCustomIcons(nextIcons);
            localStorage.setItem('zenith_bookmark_category_icons', JSON.stringify(nextIcons));
            
            setIsEditingCategory(null);
        } catch (err) {
            console.error(err);
            showToast('error', 'Failed to rename category or save icon changes');
        }
    };

    const [showScrollTop, setShowScrollTop] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Fetch Bookmarks on Mount
    const fetchBookmarks = async () => {
        setLoading(true);
        try {
            const data = await bookmarksService.getBookmarks();
            setBookmarks(data);
        } catch (err) {
            console.error('Failed to load bookmarks', err);
            showToast('error', 'Failed to load bookmarks');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBookmarks();
    }, []);

    // Sync editing states
    useEffect(() => {
        if (isEditing) {
            setEditCategory(isEditing.category);
            setEditPriority(isEditing.priority);
        }
    }, [isEditing]);

    const [categoryEditName, setCategoryEditName] = useState('');
    const [categoryEditIcon, setCategoryEditIcon] = useState('Folder');

    useEffect(() => {
        if (isEditingCategory) {
            setCategoryEditName(isEditingCategory);
            const currentMeta = getCategoryMeta(isEditingCategory, customIcons);
            setCategoryEditIcon(currentMeta.iconName);
        }
    }, [isEditingCategory, customIcons]);

    // Close sort dropdown on click outside
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (sortDropdownRef.current && !sortDropdownRef.current.contains(e.target as Node)) {
                setSortDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Global keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Focus search with '/'
            if (e.key === '/' && document.activeElement !== searchInputRef.current) {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
            // Clear filters with Escape
            if (e.key === 'Escape') {
                setSearchQuery('');
                setSelectedTags([]);
                setSelectedCategory('All');
                setSelectedIds(new Set());
                setIsEditing(null);
                setSortDropdownOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Scroll-to-top display trigger
    useEffect(() => {
        const handleScroll = () => {
            if (window.scrollY > 300) {
                setShowScrollTop(true);
            } else {
                setShowScrollTop(false);
            }
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Get Domain Name from URL
    const getDomain = (url: string) => {
        try {
            const parsed = new URL(url);
            return parsed.hostname.replace('www.', '');
        } catch {
            return 'website';
        }
    };

    // Toggle select bookmark
    const toggleSelect = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        setSelectedIds(next);
    };

    // Toggle select all visible bookmarks
    const toggleSelectAll = (visibleBookmarks: BookmarkType[]) => {
        if (selectedIds.size === visibleBookmarks.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(visibleBookmarks.map(b => b.id)));
        }
    };

    // Handle Bookmark click
    const handleBookmarkClick = async (bookmark: BookmarkType) => {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate(5);
        }
        // Open URL in new window immediately for smooth UX
        window.open(bookmark.url, '_blank', 'noopener,noreferrer');

        try {
            const updated = await bookmarksService.recordClick(bookmark.id);
            // Update local state click info
            setBookmarks(prev => prev.map(b => b.id === bookmark.id ? updated : b));
        } catch (err) {
            console.error('Failed to record click', err);
        }
    };

    // Delete bookmark
    const handleDelete = async (id: string) => {
        try {
            await bookmarksService.deleteBookmark(id);
            setBookmarks(prev => prev.filter(b => b.id !== id));
            showToast('success', 'Bookmark deleted');
            if (selectedIds.has(id)) {
                const next = new Set(selectedIds);
                next.delete(id);
                setSelectedIds(next);
            }
        } catch (err) {
            showToast('error', 'Failed to delete bookmark');
        }
    };

    // Bulk delete selected
    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        if (!window.confirm(`Are you sure you want to delete ${selectedIds.size} bookmarks?`)) return;

        const idsArray = Array.from(selectedIds);
        try {
            await bookmarksService.batchDeleteBookmarks(idsArray);
            setBookmarks(prev => prev.filter(b => !selectedIds.has(b.id)));
            setSelectedIds(new Set());
            showToast('success', `Deleted ${idsArray.length} bookmarks`);
        } catch (err) {
            showToast('error', 'Failed to delete selected bookmarks');
        }
    };

    // Save edited bookmark
    const handleSaveEdit = async (id: string, updatedFields: Partial<BookmarkType>) => {
        try {
            const updated = await bookmarksService.updateBookmark(id, updatedFields);
            setBookmarks(prev => prev.map(b => b.id === id ? updated : b));
            setIsEditing(null);
            showToast('success', 'Bookmark updated');
        } catch (err) {
            showToast('error', 'Failed to update bookmark');
        }
    };

    // Parse and Import File Content
    const processImport = async (contentStr: string, type: 'html' | 'json') => {
        setLoading(true);
        try {
            const res = await bookmarksService.importBookmarks(contentStr, type);
            showToast('success', `Successfully imported ${res.importedCount} bookmarks!`);
            fetchBookmarks();
        } catch (err: any) {
            showToast('error', err.response?.data?.error || 'Failed to parse/import file');
            setLoading(false);
        }
    };



    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            handleUploadedFile(e.target.files[0]);
        }
    };

    const handleUploadedFile = (file: File) => {
        const isJson = file.name.endsWith('.json') || file.type === 'application/json';
        const isHtml = file.name.endsWith('.html') || file.name.endsWith('.htm') || file.type === 'text/html';

        if (!isJson && !isHtml) {
            showToast('error', 'Please upload a valid bookmarks .html or .json file');
            return;
        }

        const type = isHtml ? 'html' : 'json';

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            if (text) {
                processImport(text, type);
            }
        };
        reader.readAsText(file);
    };

    // Batch AI Optimization
    const handleAiEnrich = async () => {
        // Collect bookmark IDs to process.
        // If some are selected, process them. Otherwise, process all pending or non-standard category links.
        let idsToProcess = selectedIds.size > 0 
            ? Array.from(selectedIds) 
            : bookmarks.filter(b => !b.ai_processed || !DEFAULT_CATEGORIES.includes(b.category)).map(b => b.id);

        if (idsToProcess.length === 0) {
            showToast('info', 'No pending bookmarks to organize. Select bookmarks or upload new ones.');
            return;
        }

        // Re-introduce 80-item cap per run when starting auto-enrich to avoid API rate limits
        if (idsToProcess.length > 80 && selectedIds.size === 0) {
            idsToProcess = idsToProcess.slice(0, 80);
        }

        setAiEnriching(true);
        setAiProgress({ current: 0, total: idsToProcess.length });

        const batchSize = 20;
        const total = idsToProcess.length;
        const results: BookmarkType[] = [];

        try {
            for (let i = 0; i < total; i += batchSize) {
                if (i > 0) {
                    // 4.5-second delay between batches to respect Groq API rate limits (RPM / TPM)
                    await new Promise(resolve => setTimeout(resolve, 4500));
                }
                const chunk = idsToProcess.slice(i, i + batchSize);
                const res = await bookmarksService.aiEnrich(chunk);
                results.push(...res.bookmarks);
                setAiProgress({ current: Math.min(i + batchSize, total), total });

                // Incremental Sync: update state immediately so progress isn't lost on rate limits/errors
                const chunkMap = new Map(res.bookmarks.map(b => [b.id, b]));
                setBookmarks(prev => prev.map(b => chunkMap.has(b.id) ? chunkMap.get(b.id)! : b));
            }

            setSelectedIds(new Set());
            showToast('success', `AI successfully categorized and cleaned ${results.length} bookmarks!`);
        } catch (err) {
            console.error(err);
            showToast('error', 'AI organization encountered rate-limit or error. Please try again shortly.');
        } finally {
            setAiEnriching(false);
        }
    };

    // Compute Derived Data / Filtered Lists
    const categoriesCount = useMemo(() => {
        return {
            All: bookmarks.length,
            'Recently Used': bookmarks.filter(b => b.clicked_at).length,
            Duplicates: bookmarks.filter(b => b.is_duplicate).length,
        };
    }, [bookmarks]);

    const dynamicCategories = useMemo(() => {
        const counts: Record<string, number> = {};
        bookmarks.forEach(b => {
            const cat = b.category || 'General';
            counts[cat] = (counts[cat] || 0) + 1;
        });
        return Object.entries(counts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);
    }, [bookmarks]);

    const allTags = useMemo(() => {
        const tagsMap: Record<string, number> = {};
        bookmarks.forEach(b => {
            (b.tags || []).forEach(t => {
                tagsMap[t] = (tagsMap[t] || 0) + 1;
            });
        });
        return Object.entries(tagsMap)
            .sort((a, b) => b[1] - a[1]) // sort by frequency
            .slice(0, 15); // get top 15
    }, [bookmarks]);

    const filteredBookmarks = useMemo(() => {
        let list = [...bookmarks];

        // 1. Category Filter
        if (selectedCategory !== 'All') {
            if (selectedCategory === 'Recently Used') {
                list = list.filter(b => b.clicked_at).sort((a, b) => {
                    const dateA = a.clicked_at ? new Date(a.clicked_at).getTime() : 0;
                    const dateB = b.clicked_at ? new Date(b.clicked_at).getTime() : 0;
                    return dateB - dateA;
                });
            } else if (selectedCategory === 'Duplicates') {
                list = list.filter(b => b.is_duplicate);
            } else {
                list = list.filter(b => b.category === selectedCategory);
            }
        }

        // 2. Tags Filter
        if (selectedTags.length > 0) {
            list = list.filter(b => selectedTags.every(t => b.tags.includes(t)));
        }

        // 3. Search Query Filter (Matches Title, URL, Tags, Category)
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            list = list.filter(b => 
                (b.cleaned_title && b.cleaned_title.toLowerCase().includes(query)) ||
                b.title.toLowerCase().includes(query) ||
                b.url.toLowerCase().includes(query) ||
                b.tags.some(t => t.toLowerCase().includes(query)) ||
                b.category.toLowerCase().includes(query)
            );
        }

        // 4. Sort (Skip if Already Sorting by Clicked Date in 'Recently Used')
        if (selectedCategory !== 'Recently Used') {
            list.sort((a, b) => {
                let valA: any = a[sortBy];
                let valB: any = b[sortBy];

                // fallbacks
                if (sortBy === 'title') {
                    valA = a.cleaned_title || a.title;
                    valB = b.cleaned_title || b.title;
                }

                if (typeof valA === 'string') {
                    return sortOrder === 'asc' 
                        ? valA.localeCompare(valB) 
                        : valB.localeCompare(valA);
                } else {
                    return sortOrder === 'asc' 
                        ? (valA || 0) - (valB || 0) 
                        : (valB || 0) - (valA || 0);
                }
            });
        }

        return list;
    }, [bookmarks, selectedCategory, selectedTags, searchQuery, sortBy, sortOrder]);

    const stats = useMemo(() => {
        return {
            total: bookmarks.length,
            aiProcessed: bookmarks.filter(b => b.ai_processed).length,
            duplicates: bookmarks.filter(b => b.is_duplicate).length,
            activeTags: Object.keys(allTags).length,
        };
    }, [bookmarks, allTags]);

    const allCategories = useMemo(() => {
        const unique = new Set([...DEFAULT_CATEGORIES, ...dynamicCategories.map(c => c.name)]);
        return Array.from(unique).sort((a, b) => a.localeCompare(b));
    }, [dynamicCategories]);

    return (
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto min-h-screen text-on-surface">
            {/* Page Header */}
            <div className="mb-8">
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40 mb-2">
                    Tools / Bookmarks
                </p>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                        <h1 className="text-2xl font-bold text-on-surface tracking-tight">Bookmarks</h1>
                        <p className="text-xs text-on-surface-variant/40 mt-0.5">{bookmarks.length} resources organized</p>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="h-9 px-3.5 flex items-center gap-2 text-xs font-bold rounded bg-surface border border-outline hover:bg-surface-container text-on-surface transition-all cursor-pointer"
                        >
                            <Upload size={13} />
                            Import Bookmarks
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".html,.json"
                            className="hidden"
                            onChange={handleFileInputChange}
                        />

                        <button
                            onClick={handleAiEnrich}
                            disabled={aiEnriching || bookmarks.length === 0}
                            className="h-9 px-3.5 flex items-center gap-2 text-xs font-bold rounded bg-on-surface text-surface hover:opacity-90 disabled:opacity-40 transition-all cursor-pointer"
                        >
                            <Sparkles size={13} className={aiEnriching ? 'animate-spin' : ''} />
                            {selectedIds.size > 0 ? `Optimize Selected (${selectedIds.size})` : 'AI Auto-Organize'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Glowing AI Enrichment Banner */}
            <AnimatePresence>
                {aiEnriching && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="w-full bg-primary/10 border border-primary/20 rounded-2xl p-4 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-inner"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-primary/20 text-primary animate-pulse">
                                <Sparkles className="w-4 h-4" />
                            </div>
                            <div>
                                <p className="text-xs font-bold">Zenith AI Organizer is running...</p>
                                <p className="text-[10px] text-on-surface-variant/60 mt-0.5">Categorizing, scoring priority, cleaning titles, and extracting metadata keywords.</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 min-w-[200px] md:justify-end">
                            <div className="flex-1 h-2 bg-surface-container rounded-full overflow-hidden border border-outline/10">
                                <motion.div 
                                    className="h-full bg-primary rounded-full"
                                    style={{ width: `${(aiProgress.current / aiProgress.total) * 100}%` }}
                                    transition={{ ease: "easeInOut" }}
                                />
                            </div>
                            <span className="text-[11px] font-bold shrink-0">{aiProgress.current} / {aiProgress.total}</span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Stats Dashboard Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
                {[
                    { label: 'Total Links', value: stats.total, color: 'text-primary' },
                    { label: 'AI Processed', value: stats.aiProcessed, progress: stats.total ? Math.round((stats.aiProcessed / stats.total) * 100) : 0, color: 'text-green-500' },
                    { label: 'Duplicate URLs', value: stats.duplicates, color: 'text-amber-500', alert: stats.duplicates > 0 },
                    { label: 'Active Topics', value: stats.activeTags, color: 'text-purple-500' }
                ].map((s, idx) => (
                    <div key={idx} className="bg-surface/50 border border-outline/20 backdrop-blur-md rounded-2xl p-4 flex flex-col justify-between h-20 shadow-sm relative overflow-hidden group hover:border-outline/40 transition-colors">
                        <span className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest leading-none">{s.label}</span>
                        <div className="flex items-end justify-between mt-2">
                            <span className={`text-xl font-bold font-mono tracking-tight leading-none ${s.color}`}>{s.value}</span>
                            {s.progress !== undefined && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-500/10 text-green-500 font-mono">{s.progress}%</span>
                            )}
                            {s.alert && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 animate-pulse flex items-center gap-1">
                                    <AlertTriangle size={10} />
                                    Clean
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Layout Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6 items-start">
                
                {/* Sidebar Filter Area */}
                <div className="hidden lg:block space-y-6 lg:sticky lg:top-20">
                    
                    {/* Categories Filter Card */}
                    <div className="bg-surface/50 border border-outline/10 backdrop-blur-md rounded-2xl p-3.5 shadow-sm">
                        <p className="text-[9px] font-bold text-on-surface-variant/40 uppercase tracking-widest px-2 mb-3">Folders / Channels</p>
                        <div className="space-y-1">
                            {/* Fixed Quick Filters */}
                            {[
                                { name: 'All', icon: Folder, count: categoriesCount.All, color: 'hover:bg-primary/5 hover:text-primary' },
                                { name: 'Recently Used', icon: Clock, count: categoriesCount['Recently Used'], color: 'hover:bg-purple-500/5 hover:text-purple-500' },
                                { name: 'Duplicates', icon: AlertTriangle, count: categoriesCount.Duplicates, countColor: 'text-amber-500 bg-amber-500/10', color: 'hover:bg-amber-500/5 hover:text-amber-500' }
                            ].map(cat => {
                                const isActive = selectedCategory === cat.name;
                                return (
                                    <button
                                        key={cat.name}
                                        onClick={() => { setSelectedCategory(cat.name); setSelectedTags([]); }}
                                        className={`w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold rounded-xl border border-transparent transition-all cursor-pointer ${
                                            isActive
                                                ? 'bg-surface-container text-on-surface font-bold border-outline/15 shadow-sm'
                                                : `text-on-surface-variant/75 ${cat.color}`
                                        }`}
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <cat.icon size={13.5} className="opacity-55" />
                                            <span>{cat.name}</span>
                                        </div>
                                        <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-surface-container-high text-on-surface-variant/45 ${cat.countColor || ''}`}>
                                            {cat.count}
                                        </span>
                                    </button>
                                );
                            })}

                            <div className="border-t border-outline/10 my-2 pt-2" />

                            {/* Dynamic AI categories list */}
                            {dynamicCategories.map(cat => {
                                const isActive = selectedCategory === cat.name;
                                const meta = getCategoryMeta(cat.name, customIcons);
                                const IconComp = meta.icon;
                                return (
                                    <div
                                        key={cat.name}
                                        className={`group/btn w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold rounded-xl border border-transparent transition-all ${
                                            isActive
                                                ? 'bg-surface-container text-on-surface font-bold border-outline/15 shadow-sm'
                                                : `text-on-surface-variant/75 ${meta.color}`
                                        }`}
                                    >
                                        <button
                                            onClick={() => { setSelectedCategory(cat.name); setSelectedTags([]); }}
                                            className="flex-1 flex items-center gap-2.5 min-w-0 text-left cursor-pointer"
                                        >
                                            <IconComp size={13.5} className="opacity-55 shrink-0" />
                                            <span className="truncate">{cat.name}</span>
                                        </button>
                                        <div className="relative h-5 flex items-center justify-center min-w-[20px] ml-1">
                                            <span className="group-hover/btn:opacity-0 transition-opacity duration-150 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-surface-container-high text-on-surface-variant/45 shrink-0">
                                                {cat.count}
                                            </span>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setIsEditingCategory(cat.name);
                                                }}
                                                className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/btn:opacity-100 text-on-surface-variant/40 hover:text-primary transition-opacity duration-150 cursor-pointer"
                                                title="Edit Category Name & Icon"
                                            >
                                                <Edit size={11} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Popular Tags Filter Card */}
                    {allTags.length > 0 && (
                        <div className="bg-surface/50 border border-outline/10 backdrop-blur-md rounded-2xl p-4 shadow-sm">
                            <p className="text-[9px] font-bold text-on-surface-variant/40 uppercase tracking-widest mb-3">Filter by Topic</p>
                            <div className="flex flex-wrap gap-1.5">
                                {allTags.map(([tag, count]) => {
                                    const isSelected = selectedTags.includes(tag);
                                    return (
                                        <button
                                            key={tag}
                                            onClick={() => {
                                                if (isSelected) {
                                                    setSelectedTags(selectedTags.filter(t => t !== tag));
                                                } else {
                                                    setSelectedTags([...selectedTags, tag]);
                                                }
                                            }}
                                            className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition-all cursor-pointer ${
                                                isSelected
                                                    ? 'bg-primary text-surface border-primary shadow-sm shadow-primary/10'
                                                    : 'bg-surface border-outline hover:bg-surface-container text-on-surface-variant/80'
                                            }`}
                                        >
                                            #{tag} <span className="opacity-40 font-mono text-[9px] ml-0.5">({count})</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                </div>

                {/* Bookmarks Main Panel */}
                <div className="space-y-4 min-w-0">
                    
                    {/* Mobile Filters Horizontal Scrollable Strip */}
                    <div className="flex lg:hidden flex-col gap-2 mb-2">
                        <p className="text-[9px] font-bold text-on-surface-variant/40 uppercase tracking-widest leading-none select-none pl-1">Folders / Channels</p>
                        <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-none -mx-4 px-4 mask-image">
                            {[
                                { name: 'All', icon: Folder, count: categoriesCount.All },
                                { name: 'Recently Used', icon: Clock, count: categoriesCount['Recently Used'] },
                                { name: 'Duplicates', icon: AlertTriangle, count: categoriesCount.Duplicates, countColor: 'text-amber-500 bg-amber-500/10' },
                                ...dynamicCategories.map(cat => ({
                                    name: cat.name,
                                    icon: getCategoryMeta(cat.name, customIcons).icon,
                                    count: cat.count,
                                    countColor: ''
                                }))
                            ].map(cat => {
                                const isActive = selectedCategory === cat.name;
                                const IconComp = cat.icon;
                                return (
                                    <button
                                        key={cat.name}
                                        onClick={() => { setSelectedCategory(cat.name); setSelectedTags([]); }}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full border transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                                            isActive
                                                ? 'bg-on-surface text-surface border-on-surface font-bold shadow-sm'
                                                : 'bg-surface/50 border-outline/10 text-on-surface-variant/75 hover:bg-surface-container hover:text-on-surface'
                                        }`}
                                    >
                                        <IconComp size={11} className="opacity-60 shrink-0" />
                                        <span>{cat.name}</span>
                                        <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                                            isActive
                                                ? 'bg-surface/20 text-surface'
                                                : cat.countColor || 'bg-surface-container-high text-on-surface-variant/40'
                                        }`}>
                                            {cat.count}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Mobile Tags Filter Strip */}
                        {allTags.length > 0 && (
                            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none -mx-4 px-4">
                                {allTags.map(([tag, count]) => {
                                    const isSelected = selectedTags.includes(tag);
                                    return (
                                        <button
                                            key={tag}
                                            onClick={() => {
                                                if (isSelected) {
                                                    setSelectedTags(selectedTags.filter(t => t !== tag));
                                                } else {
                                                    setSelectedTags([...selectedTags, tag]);
                                                }
                                            }}
                                            className={`text-[9px] font-bold px-2.5 py-1 rounded-full border transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                                                isSelected
                                                    ? 'bg-primary text-surface border-primary shadow-sm'
                                                    : 'bg-surface/50 border-outline/10 hover:bg-surface-container text-on-surface-variant/80'
                                            }`}
                                        >
                                            #{tag} <span className="opacity-40 font-mono text-[8px] ml-0.5">({count})</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                    
                    {/* Search & Toolbar Card */}
                    <div className="relative z-30 bg-surface/50 border border-outline/10 backdrop-blur-md rounded-2xl p-3 shadow-sm flex flex-col md:flex-row items-center gap-3 justify-between">
                        
                        {/* Search Input Box */}
                        <div className="relative w-full md:max-w-md flex-1 group">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/40 group-hover:text-on-surface-variant/60 group-focus-within:text-primary transition-colors pointer-events-none" />
                            <input
                                ref={searchInputRef}
                                type="text"
                                placeholder="Search bookmarks... (Press '/')"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full bg-surface border border-outline/80 hover:border-outline focus:border-primary focus:ring-4 focus:ring-primary/10 rounded-xl pl-10 pr-10 py-2.5 text-xs font-semibold placeholder:text-on-surface-variant/35 outline-none transition-all duration-200"
                            />
                            {searchQuery && (
                                <button 
                                    onClick={() => setSearchQuery('')}
                                    className="no-fluid absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-5 h-5 rounded-full text-on-surface-variant/40 hover:text-on-surface hover:bg-surface-container transition-colors"
                                >
                                    <X size={14} className="shrink-0" />
                                </button>
                            )}
                        </div>

                        {/* Sorting Dropdowns */}
                        <div className="flex items-center justify-between md:justify-end gap-2 shrink-0 w-full md:w-auto">
                            <div ref={sortDropdownRef} className="relative flex items-center border border-outline/80 rounded-xl bg-surface p-1 flex-1 md:flex-none justify-between md:justify-start">
                                <button 
                                    onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                                    className="p-1.5 text-on-surface-variant/65 hover:bg-surface-container rounded-lg cursor-pointer transition-colors"
                                    title="Toggle Sort Order"
                                >
                                    <ArrowUpDown size={12} className={sortOrder === 'asc' ? 'rotate-180 transition-transform duration-200' : 'transition-transform duration-200'} />
                                </button>
                                
                                <div className="border-l border-outline/30 h-4 mx-0.5" />
                                
                                <button
                                    onClick={() => setSortDropdownOpen(!sortDropdownOpen)}
                                    className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-bold text-on-surface hover:bg-surface-container rounded-lg cursor-pointer transition-colors"
                                >
                                    <span>
                                        {sortBy === 'created_at' && 'Date Added'}
                                        {sortBy === 'click_count' && 'Popularity'}
                                        {sortBy === 'priority' && 'Priority'}
                                        {sortBy === 'title' && 'Alphabetical'}
                                    </span>
                                    <ChevronDown size={11} className={`opacity-60 transition-transform duration-200 ${sortDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>

                                <AnimatePresence>
                                    {sortDropdownOpen && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -4, scale: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: -4, scale: 0.95 }}
                                            transition={{ duration: 0.12, ease: 'easeOut' }}
                                            className="absolute right-0 top-full mt-1.5 w-40 rounded-xl border border-outline bg-surface shadow-xl py-1.5 z-50 overflow-hidden"
                                        >
                                            {[
                                                { value: 'created_at', label: 'Date Added' },
                                                { value: 'click_count', label: 'Popularity' },
                                                { value: 'priority', label: 'Priority' },
                                                { value: 'title', label: 'Alphabetical' }
                                            ].map(opt => {
                                                const isSelected = sortBy === opt.value;
                                                return (
                                                    <button
                                                        key={opt.value}
                                                        type="button"
                                                        onClick={() => {
                                                            setSortBy(opt.value as any);
                                                            setSortDropdownOpen(false);
                                                        }}
                                                        className={`w-full px-3.5 py-2 text-left text-[11px] font-semibold flex items-center justify-between transition-colors ${
                                                            isSelected 
                                                                ? 'bg-primary/10 text-primary' 
                                                                : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                                                        }`}
                                                    >
                                                        <span>{opt.label}</span>
                                                        {isSelected && <Check size={11} className="text-primary shrink-0" />}
                                                    </button>
                                                );
                                            })}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {selectedCategory !== 'All' && (
                                <button 
                                    onClick={() => { setSelectedCategory('All'); setSelectedTags([]); setSearchQuery(''); }}
                                    className="p-2 text-on-surface-variant/50 hover:text-on-surface border border-outline hover:bg-surface-container rounded-xl cursor-pointer transition-colors"
                                    title="Reset Filters"
                                >
                                    <X size={12.5} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Bulk Actions Console */}
                    <AnimatePresence>
                        {selectedIds.size > 0 && (
                            <motion.div
                                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.98 }}
                                className="bg-primary/5 border border-primary/20 rounded-2xl px-4 py-3 shadow-md flex items-center justify-between flex-wrap gap-3"
                            >
                                <div className="flex items-center gap-2">
                                    <CheckSquare size={14} className="text-primary" />
                                    <span className="text-xs font-bold text-primary">{selectedIds.size} Selected</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={handleAiEnrich}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-surface hover:bg-primary/95 text-[11px] font-bold transition-all cursor-pointer"
                                    >
                                        <Sparkles size={11} />
                                        Optimize with AI
                                    </button>
                                    <button 
                                        onClick={handleBulkDelete}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 text-red-500 text-[11px] font-bold transition-all cursor-pointer"
                                    >
                                        <Trash2 size={11} />
                                        Delete Selected
                                    </button>
                                    <button 
                                        onClick={() => setSelectedIds(new Set())}
                                        className="p-1.5 text-on-surface-variant/50 hover:text-on-surface rounded-lg cursor-pointer"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Selected tag badges display */}
                    {selectedTags.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-wider flex items-center gap-1">
                                <Tag size={10} />
                                Filtering Tags:
                            </span>
                            {selectedTags.map(tag => (
                                <span 
                                    key={tag} 
                                    className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg bg-primary/10 text-primary border border-primary/10"
                                >
                                    #{tag}
                                    <button onClick={() => setSelectedTags(selectedTags.filter(t => t !== tag))} className="hover:text-primary-dark">
                                        <X size={10} />
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Bookmarks List View */}
                    <div className="space-y-2.5">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 text-on-surface-variant/50">
                                <RefreshCw className="w-8 h-8 animate-spin text-primary/40" />
                                <span className="text-xs font-semibold mt-3">Loading resources...</span>
                            </div>
                        ) : filteredBookmarks.length === 0 ? (
                            <div className="border border-outline/10 rounded-2xl bg-surface/20 py-20 px-4 text-center">
                                <Bookmark className="w-10 h-10 text-on-surface-variant/15 mx-auto mb-3" />
                                <h3 className="text-sm font-bold text-on-surface">No bookmarks found</h3>
                                <p className="text-xs text-on-surface-variant/50 max-w-sm mx-auto mt-1">
                                    No resources matched your filters or search keywords. Import a bookmarks file or optimize existing ones with AI.
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center justify-between px-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/30 select-none">
                                    <div className="flex items-center gap-2">
                                        <button 
                                            onClick={() => toggleSelectAll(filteredBookmarks)}
                                            className="p-1 hover:bg-surface-container rounded cursor-pointer"
                                        >
                                            {selectedIds.size === filteredBookmarks.length ? <CheckSquare size={12} /> : <Square size={12} />}
                                        </button>
                                        <span>Website Resource ({filteredBookmarks.length})</span>
                                    </div>
                                    <span className="hidden md:block">Priority / Category</span>
                                </div>

                                <div className="grid grid-cols-1 gap-2">
                                    {filteredBookmarks.map(b => {
                                        const isSelected = selectedIds.has(b.id);
                                        return (
                                            <motion.div
                                                layout="position"
                                                key={b.id}
                                                className={`group relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 border rounded-2xl px-4 py-3 shadow-sm transition-all duration-200 bg-surface/40 hover:bg-surface/70 ${
                                                    b.is_duplicate 
                                                        ? 'border-amber-500/20 bg-amber-500/[0.01]' 
                                                        : isSelected 
                                                            ? 'border-primary/40 bg-primary/[0.01]' 
                                                            : 'border-outline/10'
                                                }`}
                                            >
                                                {/* Left Section: Checkbox & Meta */}
                                                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                                                    <button 
                                                        onClick={() => toggleSelect(b.id)}
                                                        className={`shrink-0 cursor-pointer ${isSelected ? 'text-primary' : 'text-on-surface-variant/25 hover:text-on-surface-variant/60'}`}
                                                    >
                                                        {isSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                                                    </button>

                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <button
                                                                onClick={() => handleBookmarkClick(b)}
                                                                className="text-xs md:text-sm font-bold text-on-surface hover:text-primary hover:underline truncate text-left cursor-pointer flex items-center gap-2"
                                                            >
                                                                <img
                                                                    src={`https://www.google.com/s2/favicons?domain=${getDomain(b.url)}&sz=32`}
                                                                    className="w-4 h-4 rounded-md object-contain bg-surface-container shrink-0"
                                                                    alt=""
                                                                    loading="lazy"
                                                                />
                                                                <span>{b.cleaned_title || b.title}</span>
                                                                <ExternalLink size={10} className="opacity-0 group-hover:opacity-40 transition-opacity shrink-0" />
                                                            </button>

                                                            {/* Duplicate Alert */}
                                                            {b.is_duplicate && (
                                                                <span className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/15 flex items-center gap-0.5 shrink-0">
                                                                    <AlertTriangle size={8} /> DUPLICATE
                                                                </span>
                                                            )}

                                                            {/* AI Unprocessed Status dot */}
                                                            {!b.ai_processed && (
                                                                <span className="w-1.5 h-1.5 rounded-full bg-primary/40 shrink-0" title="Pending AI Enrichment" />
                                                            )}
                                                        </div>

                                                        {/* Subtitle Details: Domain & Tags */}
                                                        <div className="flex items-center gap-2.5 mt-1 text-[10px] text-on-surface-variant/40 leading-none flex-wrap">
                                                            <span className="font-semibold tracking-wide flex items-center gap-1">
                                                                <Globe size={10} className="opacity-60" />
                                                                {getDomain(b.url)}
                                                            </span>
                                                            {b.click_count > 0 && (
                                                                <span className="opacity-75 font-mono">
                                                                    • {b.click_count} click{b.click_count > 1 ? 's' : ''}
                                                                </span>
                                                            )}
                                                            {b.tags.slice(0, 3).map(t => (
                                                                <span key={t} className="text-[9px] font-bold text-primary opacity-80 leading-none">
                                                                    #{t}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Right Section: Priority, Category Badge & Action Menu */}
                                                <div className="flex items-center justify-between sm:justify-end gap-3.5 sm:gap-4 shrink-0 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-outline/5">
                                                    
                                                    {/* Rating / Priority */}
                                                    {b.priority > 0 && (
                                                        <div className="hidden sm:flex items-center gap-0.5">
                                                            {Array.from({ length: 5 }).map((_, starIdx) => (
                                                                <Star 
                                                                    key={starIdx}
                                                                    size={10}
                                                                    className={starIdx < b.priority ? 'fill-primary text-primary' : 'text-on-surface-variant/15'}
                                                                />
                                                            ))}
                                                        </div>
                                                    )}

                                                    {/* Category Badge */}
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border leading-none tracking-wide shrink-0 ${
                                                        getCategoryMeta(b.category, customIcons).badge
                                                    }`}>
                                                        {b.category}
                                                    </span>

                                                    {/* Row Inline Edit / Actions */}
                                                    <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                                        <button 
                                                            onClick={() => setIsEditing(b)}
                                                            className="p-1.5 hover:bg-surface-container rounded-lg text-on-surface-variant/40 hover:text-on-surface cursor-pointer"
                                                            title="Edit Details"
                                                        >
                                                            <Edit size={11} />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDelete(b.id)}
                                                            className="p-1.5 hover:bg-red-500/5 rounded-lg text-on-surface-variant/30 hover:text-red-500 cursor-pointer"
                                                            title="Delete Link"
                                                        >
                                                            <Trash2 size={11} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Inline Bookmark Editor Modal */}
            {/* Inline Bookmark Editor Modal */}
            <Modal
                isOpen={!!isEditing}
                onClose={() => setIsEditing(null)}
                title={
                    <span className="flex items-center gap-2">
                        <Edit size={14} className="text-primary" />
                        Edit Bookmark Details
                    </span>
                }
            >
                {isEditing && (
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            const formData = new FormData(e.currentTarget);
                            const cleaned_title = formData.get('cleaned_title') as string;
                            const url = formData.get('url') as string;
                            let category = formData.get('category') as string;
                            if (category === '__new__') {
                                category = (formData.get('custom_category') as string || 'General').trim();
                            }
                            const priority = parseInt(formData.get('priority') as string, 10);
                            const tags = (formData.get('tags') as string)
                                .split(',')
                                .map(t => t.trim().toLowerCase())
                                .filter(t => t !== '');

                            handleSaveEdit(isEditing.id, {
                                cleaned_title,
                                url,
                                category,
                                priority,
                                tags
                            });
                        }}
                        className="flex flex-col gap-3.5 text-xs font-semibold text-on-surface-variant"
                    >
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/50">Resource Site Name</label>
                            <input 
                                type="text" 
                                name="cleaned_title"
                                defaultValue={isEditing.cleaned_title || isEditing.title}
                                className="w-full bg-surface-container border border-outline/10 focus:border-primary rounded-xl px-3 py-2 text-on-surface outline-none"
                                required
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/50">Resource URL</label>
                            <input 
                                type="url" 
                                name="url"
                                defaultValue={isEditing.url}
                                className="w-full bg-surface-container border border-outline/10 focus:border-primary rounded-xl px-3 py-2 text-on-surface outline-none"
                                required
                            />
                        </div>

                        <Select 
                            label="Category Folder"
                            name="category"
                            value={editCategory}
                            onChange={e => setEditCategory(e.target.value)}
                            options={[
                                ...allCategories.map(cat => ({ value: cat, label: cat })),
                                { value: '__new__', label: '+ Create Custom Category...' }
                            ]}
                        />

                        {editCategory === '__new__' && (
                            <div className="flex flex-col gap-1.5 animate-fade-in">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/50">Custom Category Name</label>
                                <input 
                                    type="text" 
                                    name="custom_category"
                                    placeholder="Enter new category name"
                                    className="w-full bg-surface-container border border-outline/10 focus:border-primary rounded-xl px-3 py-2 text-on-surface outline-none"
                                    required
                                />
                            </div>
                        )}

                        <Select 
                            label="Priority Importance"
                            name="priority"
                            value={String(editPriority)}
                            onChange={e => setEditPriority(parseInt(e.target.value, 10))}
                            options={[
                                { value: '0', label: '0 - None' },
                                { value: '1', label: '1 - Low Interest' },
                                { value: '2', label: '2 - Reading Resource' },
                                { value: '3', label: '3 - Active Tool' },
                                { value: '4', label: '4 - High Importance' },
                                { value: '5', label: '5 - Critical Asset' }
                            ]}
                        />

                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/50">Tags / Topics (Comma separated)</label>
                            <input 
                                type="text" 
                                name="tags"
                                defaultValue={(isEditing.tags || []).join(', ')}
                                placeholder="e.g. react, ui, css, tutorial"
                                className="w-full bg-surface-container border border-outline/10 focus:border-primary rounded-xl px-3 py-2 text-on-surface outline-none"
                            />
                        </div>

                        <div className="border-t border-outline/10 pt-3 flex items-center justify-end gap-2.5">
                            <button 
                                type="button" 
                                onClick={() => setIsEditing(null)}
                                className="px-3.5 py-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant transition-all font-bold cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button 
                                type="submit"
                                className="px-3.5 py-2 rounded-xl bg-primary hover:bg-primary/95 text-surface transition-all font-bold cursor-pointer"
                            >
                                Save Changes
                            </button>
                        </div>
                    </form>
                )}
            </Modal>

            {/* Edit Category Modal */}
            <Modal
                isOpen={!!isEditingCategory}
                onClose={() => setIsEditingCategory(null)}
                title={
                    <span className="flex items-center gap-2">
                        <Edit size={14} className="text-primary" />
                        Edit Category Settings
                    </span>
                }
            >
                {isEditingCategory && (
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            if (isEditingCategory) {
                                handleRenameCategory(isEditingCategory, categoryEditName, categoryEditIcon);
                            }
                        }}
                        className="flex flex-col gap-3.5 text-xs font-semibold text-on-surface-variant"
                    >
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/50">Category Folder Name</label>
                            <input 
                                type="text" 
                                value={categoryEditName}
                                onChange={e => setCategoryEditName(e.target.value)}
                                className="w-full bg-surface-container border border-outline/10 focus:border-primary rounded-xl px-3 py-2 text-on-surface outline-none"
                                required
                            />
                        </div>

                        <div className="flex flex-col gap-1.5 mt-1">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/50 flex items-center gap-1.5">
                                Category Icon
                            </label>
                            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 bg-surface-container border border-outline/10 rounded-2xl p-3 max-h-[180px] overflow-y-auto">
                                {Object.keys(ICON_MAP).map(iconName => {
                                    const IconComp = ICON_MAP[iconName];
                                    const isSelected = categoryEditIcon === iconName;
                                    return (
                                        <button
                                            key={iconName}
                                            type="button"
                                            onClick={() => setCategoryEditIcon(iconName)}
                                            className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all border cursor-pointer hover:bg-surface-container-high/40 ${
                                                isSelected 
                                                    ? 'border-primary bg-primary/10 text-primary shadow-sm' 
                                                    : 'border-transparent text-on-surface-variant/70 hover:text-on-surface'
                                            }`}
                                        >
                                            <IconComp size={15} />
                                            <span className="text-[9px] font-semibold mt-1 truncate max-w-full leading-none">{iconName}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="border-t border-outline/10 pt-3 flex items-center justify-end gap-2.5">
                            <button 
                                type="button" 
                                onClick={() => setIsEditingCategory(null)}
                                className="px-3.5 py-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant transition-all font-bold cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button 
                                type="submit"
                                className="px-3.5 py-2 rounded-xl bg-primary hover:bg-primary/95 text-surface transition-all font-bold cursor-pointer"
                            >
                                Save Changes
                            </button>
                        </div>
                    </form>
                )}
            </Modal>

            {/* Scroll to Top Floating Button */}
            <AnimatePresence>
                {showScrollTop && (
                    <motion.button
                        initial={{ opacity: 0, scale: 0.8, y: 15 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: 15 }}
                        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                        className="fixed bottom-6 right-6 md:bottom-8 md:right-8 w-11 h-11 rounded-full bg-on-surface text-surface hover:opacity-90 shadow-2xl z-[999] flex items-center justify-center border border-outline/10 cursor-pointer active:scale-95 transition-transform"
                        title="Scroll to Top"
                    >
                        <ArrowUp size={16} />
                    </motion.button>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Bookmarks;
