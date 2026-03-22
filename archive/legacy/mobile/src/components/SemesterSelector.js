
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { LinearGradient } from './LinearGradient';
import * as Haptics from 'expo-haptics';

import { useSemester } from '../contexts/SemesterContext';

const SemesterSelector = ({ selectedSemester: propSem, onSelect: propOnSelect, isDark }) => {
    const { selectedSemester: globalSem, updateSemester } = useSemester();

    // Use prop if provided, otherwise use global context
    const currentSem = propSem !== undefined ? propSem : globalSem;
    const handleSelect = propOnSelect || updateSemester;

    // Aquamorphic Palette for Selector
    const c = {
        glassBg: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.7)',
        glassBorder: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
        primary: '#4facfe',
        accent: '#00f2fe',
        text: isDark ? '#FFF' : '#1A1A1A',
        subtext: isDark ? '#A1A1AA' : '#6E6E73'
    };

    const semesters = [1, 2, 3, 4, 5, 6, 7, 8];

    return (
        <View style={styles.container}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                >
                    {semesters.map((sem) => {
                        const isSelected = currentSem === sem;
                        return (
                            <TouchableOpacity
                                key={sem}
                                onPress={() => {
                                    if (currentSem !== sem) Haptics.selectionAsync();
                                    handleSelect(sem);
                                }}
                                activeOpacity={0.7}
                            >
                                {isSelected ? (
                                    <LinearGradient
                                        colors={[c.primary, c.accent]}
                                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                                        style={styles.chip}
                                    >
                                        <Text style={[styles.text, { color: '#FFF', fontWeight: '800' }]}>
                                            Sem {sem}
                                        </Text>
                                    </LinearGradient>
                                ) : (
                                    <View style={[styles.chip, { backgroundColor: c.glassBg, borderColor: c.glassBorder, borderWidth: 1 }]}>
                                        <Text style={[styles.text, { color: c.subtext }]}>
                                            Sem {sem}
                                        </Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        // marginLeft removed to align with left edge
    },
    scrollContent: {
        gap: 8,
        paddingRight: 24 // Standard padding to balance the scroll
    },
    chip: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        minWidth: 60,
        alignItems: 'center',
        justifyContent: 'center'
    },
    text: {
        fontSize: 13,
        fontWeight: '600',
    },
});

export default SemesterSelector;

