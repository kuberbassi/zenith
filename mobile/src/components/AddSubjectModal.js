import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, ScrollView, Switch, KeyboardAvoidingView, Platform, Alert, Dimensions, Animated } from 'react-native';
import PressableScale from './PressableScale';
import { theme } from '../theme';
import { X, Save, BookOpen, User, MapPin, AlertTriangle, Briefcase, Trash2, FileText } from 'lucide-react-native';
import { LinearGradient } from './LinearGradient';

import { useSemester } from '../contexts/SemesterContext';

const { height } = Dimensions.get('window');

const AddSubjectModal = ({ visible, onClose, onSave, onDelete, initialData, isDark }) => {
    const { selectedSemester } = useSemester();

    // AMOLED Theme
    const c = {
        glassBg: isDark ? ['#000000', '#000000'] : ['rgba(255, 255, 255, 0.98)', 'rgba(240, 240, 240, 0.98)'],
        glassBorder: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
        text: isDark ? '#FFF' : '#1E1F22',
        subtext: isDark ? '#BABBBD' : '#6B7280',
        primary: theme.palette.purple,
        surface: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
        inputBg: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
        danger: theme.palette.red,
    };

    const styles = getStyles(c, isDark);

    // Form State
    const [name, setName] = useState('');
    const [code, setCode] = useState('');
    const [professor, setProfessor] = useState('');
    const [classroom, setClassroom] = useState('');
    const [semester, setSemester] = useState(String(selectedSemester || '1'));
    const [syllabus, setSyllabus] = useState('');
    const [categories, setCategories] = useState(['Theory']);

    // Manual Override
    const [attended, setAttended] = useState('');
    const [total, setTotal] = useState('');
    const [practicalTotal, setPracticalTotal] = useState('');
    const [assignmentTotal, setAssignmentTotal] = useState('');

    // Animation State
    const scaleAnim = React.useRef(new Animated.Value(0.9)).current;
    const opacityAnim = React.useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            scaleAnim.setValue(0.9);
            opacityAnim.setValue(0);
            Animated.parallel([
                Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }),
                Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true })
            ]).start();

            if (initialData) {
                setName(initialData.name || '');
                setCode(initialData.code || '');
                setProfessor(initialData.professor || '');
                setClassroom(initialData.classroom || '');
                setSemester(String(initialData.semester || selectedSemester || '1'));
                setSyllabus(initialData.syllabus || '');
                setCategories(initialData.categories || ['Theory']);
                setAttended(String(initialData.attended || 0));
                setTotal(String(initialData.total || 0));
                const pTotal = initialData.practicals?.total || 10;
                setPracticalTotal(String(pTotal));
                const aTotal = initialData.assignments?.total || 4;
                setAssignmentTotal(String(aTotal));
            } else {
                resetForm();
            }
        }
    }, [visible, initialData, selectedSemester]);

    const resetForm = () => {
        setName(''); setCode(''); setProfessor(''); setClassroom('');
        setSemester(String(selectedSemester || '1')); setSyllabus(''); setCategories(['Theory']);
        setAttended('0'); setTotal('0'); setPracticalTotal('10'); setAssignmentTotal('4');
    };

    const handleSave = () => {
        if (!name.trim()) return Alert.alert('Required', 'Subject Name is required.');

        const data = {
            name, code, professor, classroom,
            semester: parseInt(semester), syllabus, categories,
            attended: parseInt(attended) || 0,
            total: parseInt(total) || 0,
            practical_total: parseInt(practicalTotal) || 0,
            assignment_total: parseInt(assignmentTotal) || 0,
            isOverride: true
        };
        if (initialData) data.subject_id = initialData._id;
        onSave(data);
    };

    const toggleCategory = (cat) => {
        setCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
    };

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={styles.backdrop}>
                <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
                <Animated.View style={[styles.modalContent, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}>
                    <View style={styles.dragHandle} />

                    <View style={styles.header}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.headerTitle}>{initialData ? 'Edit Subject' : 'New Subject'}</Text>
                            <Text style={styles.headerSub}>{initialData ? 'Modify course details' : 'Add a new course to track'}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            {initialData && (
                                <PressableScale
                                    onPress={() => {
                                        Alert.alert(
                                            'Delete Subject',
                                            `Are you sure you want to delete ${initialData.name}?`,
                                            [
                                                { text: 'Cancel', style: 'cancel' },
                                                { text: 'Delete', style: 'destructive', onPress: () => onDelete(initialData._id) }
                                            ]
                                        );
                                    }}
                                    style={[styles.closeBtn, { backgroundColor: c.danger + '15' }]}
                                >
                                    <Trash2 size={18} color={c.danger} />
                                </PressableScale>
                            )}
                            <PressableScale onPress={onClose} style={styles.closeBtn}>
                                <X size={20} color={c.text} />
                            </PressableScale>
                        </View>
                    </View>

                    <View style={{ flexShrink: 1, maxHeight: height * 0.7 }}>
                        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 }]} showsVerticalScrollIndicator={false} nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ flexGrow: 0 }}>

                            {/* Section: Basic Info */}
                            <Text style={styles.sectionLabel}>Basic Info</Text>
                            <View style={styles.inputGroup}>
                                <View style={styles.inputIcon}><BookOpen size={18} color={c.primary} /></View>
                                <TextInput
                                    style={styles.input} placeholder="Subject Name" placeholderTextColor={c.subtext}
                                    value={name} onChangeText={setName}
                                />
                            </View>

                            <View style={styles.row}>
                                {initialData && (
                                    <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                                        <Text style={styles.prefix}>#</Text>
                                        <TextInput
                                            style={styles.input} placeholder="Code" placeholderTextColor={c.subtext}
                                            value={code} onChangeText={setCode}
                                        />
                                    </View>
                                )}
                                <View style={[styles.inputGroup, { flex: 1, marginLeft: initialData ? 8 : 0 }]}>
                                    <TextInput
                                        style={styles.input} placeholder="Semester" keyboardType='numeric' placeholderTextColor={c.subtext}
                                        value={semester} onChangeText={setSemester}
                                    />
                                </View>
                            </View>

                            {/* Section: Details (Edit Only) */}
                            {initialData && (
                                <>
                                    <Text style={styles.sectionLabel}>Details</Text>
                                    <View style={styles.row}>
                                        <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                                            <View style={styles.inputIcon}><User size={18} color={c.subtext} /></View>
                                            <TextInput
                                                style={styles.input} placeholder="Professor" placeholderTextColor={c.subtext}
                                                value={professor} onChangeText={setProfessor}
                                            />
                                        </View>
                                        <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                                            <View style={styles.inputIcon}><MapPin size={18} color={c.subtext} /></View>
                                            <TextInput
                                                style={styles.input} placeholder="Room" placeholderTextColor={c.subtext}
                                                value={classroom} onChangeText={setClassroom}
                                            />
                                        </View>
                                    </View>

                                    <Text style={styles.sectionLabel}>Syllabus</Text>
                                    <View style={[styles.inputGroup, { height: 100, alignItems: 'flex-start', paddingTop: 12 }]}>
                                        <View style={[styles.inputIcon, { marginTop: 4 }]}><FileText size={18} color={c.subtext} /></View>
                                        <TextInput
                                            style={[styles.input, { textAlignVertical: 'top' }]}
                                            placeholder="Enter syllabus or notes..."
                                            placeholderTextColor={c.subtext}
                                            value={syllabus} onChangeText={setSyllabus}
                                            multiline={true}
                                            numberOfLines={4}
                                        />
                                    </View>
                                </>
                            )}

                            {/* Categories */}
                            <Text style={styles.sectionLabel}>Category</Text>
                            <View style={styles.chipRow}>
                                {['Theory', 'Practical', 'Assignment'].map(cat => {
                                    const isActive = categories.includes(cat);
                                    return (
                                        <PressableScale key={cat} onPress={() => toggleCategory(cat)}
                                            style={[styles.chip, isActive && { backgroundColor: c.primary, borderColor: c.primary }]}
                                        >
                                            <Text style={[styles.chipText, isActive && { color: '#FFF' }]}>{cat}</Text>
                                        </PressableScale>
                                    )
                                })}
                            </View>

                            {/* Component Targets (Practicals/Assignments) */}
                            {(categories.includes('Practical') || categories.includes('Assignment')) && (
                                <View style={[styles.overrideCard, { marginTop: 16 }]}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 }}>
                                        <BookOpen size={16} color={c.primary} />
                                        <Text style={[styles.overrideTitle, { color: c.primary }]}>Component Targets</Text>
                                    </View>
                                    <View style={styles.row}>
                                        {categories.includes('Practical') && (
                                            <View style={{ flex: 1, alignItems: 'center' }}>
                                                <Text style={styles.statLabel}>PRACTICALS</Text>
                                                <TextInput style={styles.statInput} value={practicalTotal} onChangeText={setPracticalTotal} keyboardType='numeric' placeholder="10" placeholderTextColor={c.subtext} />
                                            </View>
                                        )}
                                        {categories.includes('Practical') && categories.includes('Assignment') && (
                                            <View style={{ width: 1, height: 40, backgroundColor: c.glassBorder }} />
                                        )}
                                        {categories.includes('Assignment') && (
                                            <View style={{ flex: 1, alignItems: 'center' }}>
                                                <Text style={styles.statLabel}>ASSIGNMENTS</Text>
                                                <TextInput style={styles.statInput} value={assignmentTotal} onChangeText={setAssignmentTotal} keyboardType='numeric' placeholder="4" placeholderTextColor={c.subtext} />
                                            </View>
                                        )}
                                    </View>
                                </View>
                            )}
                            <View style={{ height: 60 }} />
                        </ScrollView>
                    </View>

                    {/* Footer - Sticky */}
                    <View style={styles.footer}>
                        <PressableScale onPress={handleSave}>
                            <LinearGradient
                                colors={theme.gradients.primary}
                                style={styles.saveBtn}
                                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                            >
                                <Text style={styles.saveText}>Save Details</Text>
                            </LinearGradient>
                        </PressableScale>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
};

const getStyles = (c, isDark) => StyleSheet.create({
    backdrop: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20
    },
    modalContent: {
        borderRadius: 32,
        paddingTop: 12,
        borderWidth: 1, borderColor: c.glassBorder,
        maxHeight: height * 0.85, width: '100%',
        backgroundColor: isDark ? '#000000' : '#FFF',
        overflow: 'hidden',
        flexShrink: 1
    },
    dragHandle: { width: 40, height: 4, backgroundColor: c.glassBorder, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
        paddingHorizontal: 24, marginBottom: 20
    },
    headerTitle: { fontSize: 24, fontWeight: '800', color: c.text, letterSpacing: -0.5 },
    headerSub: { fontSize: 13, color: c.subtext, marginTop: 2 },
    closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' },

    scrollContent: { paddingHorizontal: 20 },

    sectionLabel: { fontSize: 12, fontWeight: '700', color: c.subtext, textTransform: 'uppercase', marginTop: 24, marginBottom: 12, letterSpacing: 1 },

    inputGroup: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: c.inputBg,
        borderRadius: 16, paddingHorizontal: 16, height: 56, marginBottom: 12,
        borderWidth: 1, borderColor: c.glassBorder
    },
    inputIcon: { marginRight: 12 },
    prefix: { fontSize: 16, color: c.subtext, marginRight: 8, fontWeight: '700' },
    input: { flex: 1, color: c.text, fontSize: 16, fontWeight: '600', height: '100%' },
    row: { flexDirection: 'row' },

    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    chip: {
        paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20,
        borderWidth: 1, borderColor: c.glassBorder, backgroundColor: c.surface
    },
    chipText: { color: c.subtext, fontWeight: '700', fontSize: 13 },

    overrideCard: {
        marginTop: 30, padding: 20, borderRadius: 24, borderWidth: 1, borderColor: c.glassBorder
    },
    overrideTitle: { fontSize: 13, fontWeight: '800', color: '#F59E0B', letterSpacing: 0.5 },
    statLabel: { fontSize: 11, fontWeight: '800', color: c.subtext, marginBottom: 8 },
    statInput: { fontSize: 24, fontWeight: '800', color: c.text, textAlign: 'center', width: '100%' },

    footer: {
        padding: 20, borderTopWidth: 1, borderTopColor: c.glassBorder,
        backgroundColor: isDark ? '#000000' : '#F9F9F9',
        width: '100%'
    },
    saveBtn: {
        backgroundColor: c.primary, height: 56, borderRadius: 28,
        alignItems: 'center', justifyContent: 'center', shadowColor: c.primary,
        shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8
    },
    saveText: { color: '#FFF', fontSize: 16, fontWeight: '800' }
});

export default AddSubjectModal;

