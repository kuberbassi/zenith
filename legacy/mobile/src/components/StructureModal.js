import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, Modal, TextInput, TouchableOpacity,
    ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
    Animated, Dimensions, Pressable, Alert
} from 'react-native';
import { X, Clock, Plus, Trash2, Coffee, BookOpen } from 'lucide-react-native';
import { LinearGradient } from './LinearGradient';
import PressableScale from './PressableScale';
import { theme } from '../theme';

const { height } = Dimensions.get('window');

const StructureModal = ({
    visible,
    onClose,
    onSave,
    initialPeriods = [],
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
        success: '#34C759',
    };

    const styles = getStyles(c, isDark);

    const [periods, setPeriods] = useState([]);
    const [isSaving, setIsSaving] = useState(false);

    // Animations
    const scaleAnim = useRef(new Animated.Value(0.9)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }),
                Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true })
            ]).start();

            setPeriods(initialPeriods.length > 0 ? initialPeriods : [
                { startTime: '09:00 AM', endTime: '10:00 AM', type: 'lecture' }
            ]);
        }
    }, [visible, initialPeriods]);

    const addPeriod = () => {
        const last = periods[periods.length - 1];
        let newStart = '09:00 AM';
        let newEnd = '10:00 AM';

        if (last) {
            newStart = last.endTime;
            // Add 1 hour to last end time logic
            const [time, period] = last.endTime.split(' ');
            let [h, m] = time.split(':').map(Number);
            h = (h % 12) + 1;
            const newPeriod = (h === 12) ? (period === 'AM' ? 'PM' : 'AM') : period;
            newEnd = `${h}:${m.toString().padStart(2, '0')} ${newPeriod}`;
        }

        setPeriods([...periods, { startTime: newStart, endTime: newEnd, type: 'lecture' }]);
    };

    const removePeriod = (index) => {
        if (periods.length === 1) return;
        const newPeriods = periods.filter((_, i) => i !== index);
        setPeriods(newPeriods);
    };

    const updatePeriod = (index, field, value) => {
        const newPeriods = [...periods];
        newPeriods[index] = { ...newPeriods[index], [field]: value };
        setPeriods(newPeriods);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSave(periods);
            onClose();
        } catch (err) {
            Alert.alert('Error', 'Failed to save timetable structure');
        } finally {
            setIsSaving(false);
        }
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
                                <Text style={styles.title}>Timetable Structure</Text>
                                <Text style={styles.subtitle}>Define periods and breaks</Text>
                            </View>
                            <PressableScale style={styles.addBtn} onPress={addPeriod}>
                                <Plus size={20} color="#FFF" />
                            </PressableScale>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                            {periods.map((period, index) => (
                                <View key={index} style={styles.periodRow}>
                                    <View style={styles.periodHeader}>
                                        <View style={styles.periodCircle}>
                                            <Text style={styles.periodIndex}>{index + 1}</Text>
                                        </View>
                                        <View style={styles.typeToggle}>
                                            <TouchableOpacity
                                                onPress={() => updatePeriod(index, 'type', 'lecture')}
                                                style={[styles.typeOption, period.type === 'lecture' && styles.typeOptionActive]}
                                            >
                                                <BookOpen size={14} color={period.type === 'lecture' ? '#FFF' : c.subtext} />
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                onPress={() => updatePeriod(index, 'type', 'break')}
                                                style={[styles.typeOption, period.type === 'break' && [styles.typeOptionActive, { backgroundColor: '#FF9500' }]]}
                                            >
                                                <Coffee size={14} color={period.type === 'break' ? '#FFF' : c.subtext} />
                                            </TouchableOpacity>
                                        </View>
                                        <TouchableOpacity onPress={() => removePeriod(index)} style={styles.trashBtn}>
                                            <Trash2 size={16} color={c.danger} />
                                        </TouchableOpacity>
                                    </View>

                                    <View style={styles.timeInputs}>
                                        <View style={styles.inputWrap}>
                                            <Text style={styles.inputLabel}>START</Text>
                                            <TextInput
                                                style={styles.timeInput}
                                                value={period.startTime}
                                                onChangeText={(v) => updatePeriod(index, 'startTime', v)}
                                                placeholder="09:00 AM"
                                                placeholderTextColor={c.subtext}
                                            />
                                        </View>
                                        <View style={styles.inputSeparator} />
                                        <View style={styles.inputWrap}>
                                            <Text style={styles.inputLabel}>END</Text>
                                            <TextInput
                                                style={styles.timeInput}
                                                value={period.endTime}
                                                onChangeText={(v) => updatePeriod(index, 'endTime', v)}
                                                placeholder="10:00 AM"
                                                placeholderTextColor={c.subtext}
                                            />
                                        </View>
                                    </View>
                                </View>
                            ))}
                            <View style={{ height: 40 }} />
                        </ScrollView>

                        <View style={styles.footer}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                                <Text style={styles.cancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={{ flex: 1 }} onPress={handleSave} disabled={isSaving}>
                                <LinearGradient
                                    colors={theme.gradients.primary}
                                    style={styles.saveBtn}
                                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                >
                                    {isSaving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>Save Structure</Text>}
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
        maxHeight: height * 0.85,
        borderWidth: 1,
        borderColor: c.glassBorder,
        overflow: 'hidden'
    },
    dragHandle: { width: 40, height: 4, backgroundColor: c.glassBorder, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, marginBottom: 24 },
    title: { fontSize: 24, fontWeight: '800', color: c.text, letterSpacing: -0.5 },
    subtitle: { fontSize: 13, color: c.subtext, fontWeight: '600' },
    addBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', shadowColor: c.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
    scrollContent: { paddingHorizontal: 24 },
    periodRow: { backgroundColor: c.surface, borderRadius: 24, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: c.glassBorder },
    periodHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    periodCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: c.primary + '20', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    periodIndex: { fontSize: 13, fontWeight: '800', color: c.primary },
    typeToggle: { flexDirection: 'row', backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', borderRadius: 12, padding: 4, flex: 1, marginRight: 12 },
    typeOption: { flex: 1, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    typeOptionActive: { backgroundColor: c.primary },
    trashBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: c.danger + '10', alignItems: 'center', justifyContent: 'center' },
    timeInputs: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    inputWrap: { flex: 1 },
    inputLabel: { fontSize: 9, fontWeight: '800', color: c.subtext, marginBottom: 4, marginLeft: 4 },
    timeInput: { backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.5)', borderRadius: 12, height: 44, paddingHorizontal: 12, color: c.text, fontSize: 14, fontWeight: '700', textAlign: 'center' },
    inputSeparator: { width: 10, height: 1, backgroundColor: c.glassBorder, marginTop: 15 },
    footer: { flexDirection: 'row', gap: 12, padding: 24, borderTopWidth: 1, borderTopColor: c.glassBorder },
    cancelBtn: { paddingHorizontal: 20, justifyContent: 'center' },
    cancelText: { color: c.subtext, fontWeight: '700' },
    saveBtn: { height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    saveBtnText: { color: '#FFF', fontWeight: '800', fontSize: 15 }
});

export default StructureModal;
