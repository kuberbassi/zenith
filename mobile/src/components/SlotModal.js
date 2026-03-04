import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, Modal, TextInput, TouchableOpacity,
    ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
    Animated, Dimensions, Pressable
} from 'react-native';
import { X, Clock, MapPin, Book, Edit2, Coffee, LayoutDashboard, Plus } from 'lucide-react-native';
import { LinearGradient } from './LinearGradient';
import PressableScale from './PressableScale';
import { theme } from '../theme';

const { height } = Dimensions.get('window');

const SlotModal = ({
    visible,
    onClose,
    onSave,
    editingSlot,
    subjects = [],
    periods = [],
    selectedDay,
    isDark
}) => {
    // Theme Colors
    const c = {
        bg: isDark ? '#000000' : '#FFFFFF',
        text: isDark ? '#FFFFFF' : '#000000',
        subtext: isDark ? '#9CA3AF' : '#6B7280',
        primary: theme.palette.purple,
        surface: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
        glassBorder: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
        inputBg: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
        danger: '#FF3B30',
    };

    const styles = getStyles(c, isDark);

    const [newSlot, setNewSlot] = useState({
        subject_id: '',
        name: '',
        label: '',
        startTime: '09:00 AM',
        endTime: '10:00 AM',
        classroom: '',
        type: 'Lecture'
    });

    const [addingSlot, setAddingSlot] = useState(false);

    // Animations
    const scaleAnim = useRef(new Animated.Value(0.9)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }),
                Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true })
            ]).start();

            if (editingSlot) {
                const type = (editingSlot.type || 'Lecture').charAt(0).toUpperCase() + (editingSlot.type || 'Lecture').slice(1).toLowerCase();
                setNewSlot({
                    subject_id: editingSlot.subject_id || '',
                    name: editingSlot.name || '',
                    label: editingSlot.label || editingSlot.name || '',
                    startTime: editingSlot.startTime || editingSlot.time?.split('-')[0]?.trim() || '09:00 AM',
                    endTime: editingSlot.endTime || editingSlot.time?.split('-')[1]?.trim() || '10:00 AM',
                    classroom: editingSlot.classroom || '',
                    type: type === 'Class' ? 'Lecture' : type
                });
            } else {
                // Initialize with first period if available
                if (periods.length > 0) {
                    setNewSlot(prev => ({
                        ...prev,
                        startTime: periods[0].startTime,
                        endTime: periods[0].endTime,
                        type: (periods[0].type || '').toLowerCase() === 'break' ? 'Break' : 'Lecture'
                    }));
                }
            }
        }
    }, [visible, editingSlot]);

    const handleSave = async () => {
        if (!newSlot.subject_id && !['Break', 'Free', 'Custom'].includes(newSlot.type)) {
            return; // Should be handled by parent or show alert
        }
        setAddingSlot(true);
        try {
            await onSave(newSlot);
        } finally {
            setAddingSlot(false);
        }
    };

    const getMinutes = (t) => {
        if (!t) return -1;
        const lower = t.toLowerCase().replace(/\s/g, '');
        const isPM = lower.includes('pm');
        const isAM = lower.includes('am');
        let timePart = lower.replace(/[a-z]/g, '');
        let [h, m] = timePart.split(':').map(Number);
        if (isNaN(h)) return -1;
        if (isNaN(m)) m = 0;
        if (isPM && h < 12) h += 12;
        if (isAM && h === 12) h = 0;
        return h * 60 + m;
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <View style={styles.backdrop}>
                    <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
                    <Animated.View style={[styles.modalContent, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}>
                        <View style={styles.dragHandle} />

                        <View style={styles.header}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.title}>{editingSlot ? 'Edit Class' : 'New Class'}</Text>
                                <Text style={styles.subtitle}>{selectedDay}</Text>
                            </View>
                            <View style={styles.timeBadge}>
                                <Clock size={12} color={c.primary} style={{ marginRight: 6 }} />
                                <Text style={styles.timeBadgeText}>{newSlot.startTime} - {newSlot.endTime}</Text>
                            </View>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                            {/* Time Picker Chips */}
                            <Text style={styles.label}>Select Period</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.periodScroll}>
                                {periods.map((p, index) => {
                                    const isSelected = Math.abs(getMinutes(p.startTime) - getMinutes(newSlot.startTime)) < 5;
                                    return (
                                        <TouchableOpacity
                                            key={index}
                                            style={[styles.periodChip, isSelected && styles.periodChipSelected]}
                                            onPress={() => {
                                                const isBreakType = (p.type || '').toLowerCase() === 'break';
                                                setNewSlot({
                                                    ...newSlot,
                                                    startTime: p.startTime,
                                                    endTime: p.endTime,
                                                    type: isBreakType ? 'Break' : 'Lecture',
                                                    subject_id: isBreakType ? '' : newSlot.subject_id
                                                });
                                            }}
                                        >
                                            <Text style={[styles.periodNumber, isSelected && styles.periodTextSelected]}>
                                                {p.type?.toLowerCase() === 'break' ? '☕' : index + 1}
                                            </Text>
                                            <Text style={[styles.periodTime, isSelected && styles.periodTextSelected]}>{p.startTime}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>

                            {/* Slot Type Toggle */}
                            <Text style={styles.label}>Slot Type</Text>
                            <View style={styles.typeRow}>
                                <TouchableOpacity
                                    style={[styles.typeBtn, newSlot.type === 'Break' && { borderColor: '#FF9500', backgroundColor: '#FF950020' }]}
                                    onPress={() => setNewSlot({ ...newSlot, type: 'Break', subject_id: '', label: 'Break', name: 'Break' })}
                                >
                                    <Coffee size={18} color={newSlot.type === 'Break' ? '#FF9500' : c.subtext} />
                                    <Text style={[styles.typeText, newSlot.type === 'Break' && { color: '#FF9500' }]}>Break</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.typeBtn, newSlot.type === 'Free' && { borderColor: '#34C759', backgroundColor: '#34C75920' }]}
                                    onPress={() => setNewSlot({ ...newSlot, type: 'Free', subject_id: '', label: 'Free', name: 'Free' })}
                                >
                                    <LayoutDashboard size={18} color={newSlot.type === 'Free' ? '#34C759' : c.subtext} />
                                    <Text style={[styles.typeText, newSlot.type === 'Free' && { color: '#34C759' }]}>Free</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.typeBtn, newSlot.type === 'Custom' && { borderColor: c.primary, backgroundColor: c.primary + '20' }]}
                                    onPress={() => setNewSlot({ ...newSlot, type: 'Custom', subject_id: '' })}
                                >
                                    <Edit2 size={18} color={newSlot.type === 'Custom' ? c.primary : c.subtext} />
                                    <Text style={[styles.typeText, newSlot.type === 'Custom' && { color: c.primary }]}>Custom</Text>
                                </TouchableOpacity>
                            </View>

                            {newSlot.type === 'Custom' && (
                                <View style={styles.inputContainer}>
                                    <Text style={styles.label}>Custom Label</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="e.g. Project Meeting, Seminar"
                                        placeholderTextColor={c.subtext}
                                        value={newSlot.label}
                                        onChangeText={txt => setNewSlot({ ...newSlot, label: txt, name: txt })}
                                        autoFocus
                                    />
                                </View>
                            )}

                            {/* Subject Selection */}
                            {!['Break', 'Free', 'Custom'].includes(newSlot.type) && (
                                <View style={{ marginTop: 10 }}>
                                    <Text style={styles.label}>Subject</Text>
                                    <View style={styles.subjectsGrid}>
                                        {subjects.map((sub, idx) => {
                                            const subId = sub._id || sub.id;
                                            const isSelected = newSlot.subject_id === subId;
                                            return (
                                                <TouchableOpacity
                                                    key={idx}
                                                    style={[styles.subjectChip, isSelected && { backgroundColor: c.primary, borderColor: c.primary }]}
                                                    onPress={() => setNewSlot({ ...newSlot, subject_id: subId, name: sub.name, type: 'Lecture' })}
                                                >
                                                    <Text style={[styles.subjectChipText, isSelected && { color: '#FFF' }]}>{sub.name}</Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </View>
                            )}

                            {/* Classroom Input */}
                            <View style={[styles.inputContainer, { marginTop: 20 }]}>
                                <Text style={styles.label}>Classroom / Venue</Text>
                                <View style={styles.inputWrapper}>
                                    <MapPin size={18} color={c.subtext} style={{ marginRight: 10 }} />
                                    <TextInput
                                        style={styles.textInput}
                                        placeholder="Room 101, Lab A..."
                                        placeholderTextColor={c.subtext}
                                        value={newSlot.classroom}
                                        onChangeText={t => setNewSlot({ ...newSlot, classroom: t })}
                                    />
                                </View>
                            </View>

                            <View style={{ height: 40 }} />
                        </ScrollView>

                        {/* Footer Actions */}
                        <View style={styles.footer}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                                <Text style={styles.cancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={{ flex: 1 }} onPress={handleSave} disabled={addingSlot || (!newSlot.subject_id && !['Break', 'Free', 'Custom'].includes(newSlot.type))}>
                                <LinearGradient
                                    colors={theme.gradients.primary}
                                    style={styles.saveBtn}
                                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                >
                                    {addingSlot ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>{editingSlot ? 'Update' : 'Add to Schedule'}</Text>}
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const getStyles = (c, isDark) => StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalContent: {
        width: '100%',
        backgroundColor: c.bg,
        borderRadius: 32,
        paddingTop: 12,
        maxHeight: height * 0.9,
        borderWidth: 1,
        borderColor: c.glassBorder,
        overflow: 'hidden'
    },
    dragHandle: { width: 40, height: 4, backgroundColor: c.glassBorder, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, marginBottom: 20 },
    title: { fontSize: 24, fontWeight: '800', color: c.text, letterSpacing: -0.5 },
    subtitle: { fontSize: 13, color: c.subtext, textTransform: 'uppercase', fontWeight: '700', letterSpacing: 1 },
    timeBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: c.glassBorder },
    timeBadgeText: { fontWeight: '700', color: c.text, fontSize: 13 },
    scrollContent: { paddingHorizontal: 24 },
    label: { fontSize: 12, fontWeight: '800', color: c.subtext, textTransform: 'uppercase', marginBottom: 12, letterSpacing: 1 },
    periodScroll: { gap: 10, paddingBottom: 20 },
    periodChip: { backgroundColor: c.surface, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16, borderWeight: 1, borderColor: c.glassBorder, alignItems: 'center', minWidth: 80 },
    periodChipSelected: { backgroundColor: c.primary, borderColor: c.primary },
    periodNumber: { fontSize: 14, fontWeight: '800', color: c.text, marginBottom: 2 },
    periodTime: { fontSize: 10, fontWeight: '700', color: c.subtext },
    periodTextSelected: { color: '#FFF' },
    typeRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
    typeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: c.surface, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: c.glassBorder },
    typeText: { fontSize: 13, fontWeight: '700', color: c.text },
    inputContainer: { marginBottom: 20 },
    inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.inputBg, borderRadius: 16, paddingHorizontal: 16, height: 56, borderWidth: 1, borderColor: c.glassBorder },
    textInput: { flex: 1, color: c.text, fontSize: 16, fontWeight: '600' },
    subjectsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    subjectChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: c.surface, borderWidth: 1, borderColor: c.glassBorder },
    subjectChipText: { fontSize: 13, fontWeight: '700', color: c.subtext },
    input: { backgroundColor: c.inputBg, borderRadius: 16, paddingHorizontal: 16, height: 56, borderWidth: 1, borderColor: c.glassBorder, color: c.text, fontWeight: '600', fontSize: 16 },
    footer: { flexDirection: 'row', gap: 12, padding: 24, borderTopWidth: 1, borderTopColor: c.glassBorder },
    cancelBtn: { paddingHorizontal: 20, justifyContent: 'center' },
    cancelText: { color: c.subtext, fontWeight: '700' },
    saveBtn: { height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    saveBtnText: { color: '#FFF', fontWeight: '800', fontSize: 15 },
});

export default SlotModal;
