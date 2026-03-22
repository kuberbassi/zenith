import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { LinearGradient } from './LinearGradient';
import { User } from 'lucide-react-native';

const UserAvatar = ({ user, size = 44, colors, style }) => {
    const getInitials = (name) => {
        if (!name) return 'U';
        const parts = name.split(' ');
        if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
        return name[0].toUpperCase();
    };

    const imageUrl = user?.picture;

    return (
        <View style={[styles.container, { width: size, height: size }, style]}>
            {imageUrl ? (
                <Image
                    source={{ uri: imageUrl }}
                    style={styles.image}
                    defaultSource={require('../../assets/icon.png')} // Optional fallback
                />
            ) : (
                <LinearGradient
                    colors={['#8E2DE2', '#4A00E0']}
                    style={styles.initialsContainer}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <Text style={[styles.initials, { fontSize: size * 0.4 }]}>
                        {getInitials(user?.name)}
                    </Text>
                </LinearGradient>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: 100,
        overflow: 'hidden',
        backgroundColor: 'rgba(0,0,0,0.05)',
    },
    image: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    initialsContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    initials: {
        color: '#FFFFFF',
        fontWeight: '700',
    },
});

export default React.memo(UserAvatar);
