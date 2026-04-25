import * as Tone from 'tone';

class SoundManager {
    constructor() {
        this.musicEnabled = true;
        this.sfxEnabled = true;
        this.lastTriggerTimes = {}; // For throttling rapid SFX

        // High-pitched crystal/glass sound with bright harmonics
        this.crystalSynth = new Tone.PolySynth(Tone.FMSynth, {
            harmonicity: 3.01,
            modulationIndex: 14,
            oscillator: { type: 'sine' },
            envelope: {
                attack: 0.001,
                decay: 0.15,
                sustain: 0,
                release: 0.1
            },
            modulation: { type: 'square' },
            modulationEnvelope: {
                attack: 0.001,
                decay: 0.2,
                sustain: 0,
                release: 0.1
            }
        }).toDestination();
        
        // Deep resin shatter/impact sound
        this.shatterSynth = new Tone.NoiseSynth({
            noise: { type: 'white' },
            envelope: {
                attack: 0.005,
                decay: 0.4,
                sustain: 0,
                release: 0.2
            }
        }).toDestination();

        this.impactSynth = new Tone.PolySynth(Tone.MembraneSynth, {
            pitchDecay: 0.05,
            octaves: 4,
            oscillator: { type: 'sine' },
            envelope: {
                attack: 0.001,
                decay: 0.3,
                sustain: 0.01,
                release: 0.5
            }
        }).toDestination();

        // Laser/Zap synth for striped gems
        this.laserSynth = new Tone.PolySynth(Tone.MonoSynth, {
            oscillator: { type: 'sawtooth' },
            envelope: {
                attack: 0.001,
                decay: 0.3,
                sustain: 0,
                release: 0.1
            },
            filterEnvelope: {
                attack: 0.001,
                decay: 0.2,
                sustain: 0,
                baseFrequency: 200,
                octaves: 4
            }
        }).toDestination();

        // Reverb and Effects
        this.reverb = new Tone.Reverb({ decay: 3, wet: 0.45 }).toDestination();
        this.caveReverb = new Tone.Reverb({ decay: 10, wet: 0.75 }).toDestination(); // Extra deep for caves
        
        this.crystalSynth.connect(this.reverb);
        this.shatterSynth.connect(this.reverb);
        this.impactSynth.connect(this.reverb);
        this.laserSynth.connect(this.reverb);

        // Procedural background music synths
        this.ambientSynth = new Tone.PolySynth(Tone.FMSynth, {
            harmonicity: 8,
            modulationIndex: 2,
            envelope: { attack: 2, decay: 1, sustain: 1, release: 4 }
        }).toDestination();
        
        this.bassSynth = new Tone.PolySynth(Tone.MonoSynth, {
            oscillator: { type: 'sine' },
            envelope: { attack: 1, decay: 1, sustain: 0.8, release: 4 }
        }).toDestination();

        this.ambientReverb = new Tone.Reverb({ decay: 8, wet: 0.8 }).toDestination();
        
        // Music specific filter for UI interaction
        this.musicFilter = new Tone.Filter({
            type: "lowpass",
            frequency: 20000,
            rolloff: -24
        }).toDestination();

        // Music specific gain for cross-fading
        this.musicGain = new Tone.Gain(1).connect(this.musicFilter);
        
        this.ambientSynth.disconnect();
        this.bassSynth.disconnect();
        this.ambientSynth.connect(this.ambientReverb);
        this.bassSynth.connect(this.ambientReverb);
        this.ambientReverb.disconnect();
        this.ambientReverb.connect(this.musicGain);

        this.currentMusicType = null;
        this.musicLoopId = null;
        this.duckTimeout = null;
        this.notes = ['C6', 'E6', 'G6', 'B6', 'C7', 'D7'];
    }

    vibrate(pattern = 10) {
        if (!this.sfxEnabled) return;
        if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
            window.navigator.vibrate(pattern);
        }
    }

    async ensureAudioContext() {
        if (Tone.context.state !== 'running') {
            await Tone.start();
        }
    }

    duckMusic(amount = 0.4, resumeTime = 0.8) {
        if (!this.musicEnabled) return;
        
        const now = Tone.now();
        // Cancel any pending swell-backs
        this.musicGain.gain.cancelScheduledValues(now);
        
        // Rapidly duck the volume
        this.musicGain.gain.rampTo(amount, 0.1);
        
        // Schedule the swell back to full volume
        if (this.duckTimeout) clearTimeout(this.duckTimeout);
        this.duckTimeout = setTimeout(() => {
            if (this.musicEnabled) {
                this.musicGain.gain.rampTo(1.0, resumeTime);
            }
        }, 400); // Hold the duck for a moment
    }

    throttleSound(key, duration = 0.05) {
        const now = Tone.now();
        const lastTime = this.lastTriggerTimes[key] || 0;
        if (now - lastTime < duration) {
            return true;
        }
        this.lastTriggerTimes[key] = now;
        return false;
    }

    applyFilter(active, duration = 0.5) {
        if (!this.musicEnabled) return;
        const freq = active ? 350 : 20000;
        this.musicFilter.frequency.cancelScheduledValues(Tone.now());
        this.musicFilter.frequency.rampTo(freq, duration);
    }

    toggleMusic() {
        this.musicEnabled = !this.musicEnabled;
        if (!this.musicEnabled) {
            this.musicGain.gain.rampTo(0, 0.5);
            setTimeout(() => this.stopMusic(), 500);
        } else if (this.currentMusicType) {
            this.musicGain.gain.value = 0;
            this.startMusic(this.currentMusicType);
            this.musicGain.gain.rampTo(1, 1);
        }
        return this.musicEnabled;
    }

    toggleSFX() {
        this.sfxEnabled = !this.sfxEnabled;
        return this.sfxEnabled;
    }

    playClink() {
        if (!this.sfxEnabled) return;
        this.ensureAudioContext();
        if (this.throttleSound('clink', 0.02)) return;
        const note = this.notes[Math.floor(Math.random() * this.notes.length)];
        this.crystalSynth.triggerAttackRelease(note, '32n', Tone.now() + 0.01, 0.4);
        this.vibrate(5);
    }

    playMatch(comboMultiplier = 1) {
        if (!this.sfxEnabled) return;
        this.ensureAudioContext();
        if (this.throttleSound('match', 0.05)) return;
        
        // Duck the music for clear audio
        this.duckMusic(0.5);

        // Pitch shifts based on combo
        const baseOctave = 6;
        const octaveShift = Math.floor((comboMultiplier - 1) / 3);
        const octave = Math.min(8, baseOctave + octaveShift);
        
        const root = `C${octave}`;
        const fifth = `G${octave}`;
        const tenth = `E${octave + 1}`;
        
        this.crystalSynth.triggerAttackRelease([root, fifth, tenth], '16n', Tone.now() + 0.01, 0.6 + (comboMultiplier * 0.05));
        this.vibrate(10 + comboMultiplier * 5);
    }

    playLaserZap() {
        if (!this.sfxEnabled) return;
        this.ensureAudioContext();
        const now = Tone.now() + 0.01;
        this.laserSynth.triggerAttackRelease('C4', '8n', now, 0.5);
        this.laserSynth.triggerAttackRelease('C5', '16n', now + 0.05, 0.3);
        this.vibrate([20, 10, 20]);
    }

    playCrystalBlast() {
        if (!this.sfxEnabled) return;
        this.ensureAudioContext();
        if (this.throttleSound('blast', 0.1)) return;
        
        // Deep duck for explosions
        this.duckMusic(0.3, 1.2);

        const now = Tone.now() + 0.05; // Safety offset to prevent "strictly greater" errors
        this.impactSynth.triggerAttackRelease('C1', '2n', now, 0.9);
        this.shatterSynth.triggerAttackRelease('2n', now, 0.6);
        this.crystalSynth.triggerAttackRelease(['C4', 'G4', 'C5'], '4n', now + 0.1, 0.7);
        this.vibrate(50);
    }

    playSpecial() {
        if (!this.sfxEnabled) return;
        this.ensureAudioContext();
        if (this.throttleSound('special', 0.08)) return;
        
        const now = Tone.now() + 0.01;
        this.crystalSynth.triggerAttackRelease(['E6', 'B6', 'G7'], '8n', now, 0.5);
        this.shatterSynth.triggerAttackRelease('16n', now, 0.1);
        this.impactSynth.triggerAttackRelease('G2', '8n', now, 0.3);
        this.vibrate(15);
    }

    playMagicChime() {
        if (!this.sfxEnabled) return;
        this.ensureAudioContext();
        const now = Tone.now() + 0.01;
        this.crystalSynth.triggerAttackRelease('C6', '16n', now, 0.5);
        this.crystalSynth.triggerAttackRelease('E6', '16n', now + 0.05, 0.5);
        this.crystalSynth.triggerAttackRelease('G6', '16n', now + 0.1, 0.5);
        this.crystalSynth.triggerAttackRelease('C7', '8n', now + 0.15, 0.5);
        this.vibrate([5, 5, 5, 5]);
    }

    playResinShatter() {
        if (!this.sfxEnabled) return;
        this.playCrystalBlast();
    }

    startMusic(type = 'forest', fadeTime = 1.0) {
        if (this.currentMusicType === type) return;
        
        const oldType = this.currentMusicType;
        this.currentMusicType = type;
        if (!this.musicEnabled) return;
        
        this.ensureAudioContext();

        // Sub-biome transition: swap reverb profile
        if (type === 'caves') {
            this.ambientReverb.decay = 12; // Deeper reverb for caves
            this.ambientReverb.wet.rampTo(0.9, fadeTime);
        } else if (type === 'archipelago') {
            this.ambientReverb.decay = 6; // Lighter, airy reverb
            this.ambientReverb.wet.rampTo(0.6, fadeTime);
        } else {
            this.ambientReverb.decay = 8;
            this.ambientReverb.wet.rampTo(0.8, fadeTime);
        }

        // Fade out current music, then switch and fade in
        if (oldType) {
            this.musicGain.gain.rampTo(0, fadeTime / 2);
            setTimeout(() => {
                this.stopMusic();
                this._initMusicCycle(type);
                this.musicGain.gain.rampTo(1, fadeTime / 2);
            }, (fadeTime / 2) * 1000);
        } else {
            this.musicGain.gain.value = 0;
            this._initMusicCycle(type);
            this.musicGain.gain.rampTo(1, fadeTime);
        }
    }

    _initMusicCycle(type) {
        const playCycle = () => {
            if (!this.musicEnabled || this.currentMusicType !== type) return;

            const now = Tone.now();
            if (type === 'forest') {
                // Magical, Orchestral, Relaxing
                const chord = ['C3', 'E3', 'G3', 'B3'];
                this.ambientSynth.triggerAttackRelease(chord, '2n', now, 0.15);
                this.bassSynth.triggerAttackRelease('C2', '1n', now, 0.1);
                
                // Add a little melody sparkle
                const melody = ['G5', 'E5', 'B5', 'C6'];
                const mNote = melody[Math.floor(Math.random() * melody.length)];
                this.crystalSynth.triggerAttackRelease(mNote, '4n', now + 1, 0.1);
            } else if (type === 'loading') {
                // Fast-paced, shimmering ambient for loading (Removed shimmering arpeggio per request)
                const root = 'C3';
                const chord = ['C3', 'F3', 'G3', 'Bb3'];
                this.ambientSynth.triggerAttackRelease(chord, '4n', now, 0.2);
                
                this.musicLoopId = setTimeout(playCycle, 800); 
                return;
            } else if (type === 'archipelago') {
                // Airy, Watery, Breezy (Archipelago)
                const chord = ['F3', 'A3', 'C4', 'E4']; // Fmaj7
                this.ambientSynth.triggerAttackRelease(chord, '1n', now, 0.15);
                this.bassSynth.triggerAttackRelease('F2', '1n', now, 0.1);
                
                // Rapid descending sparkle like water droplets
                ['C7', 'A6', 'G6', 'E6'].forEach((n, i) => {
                    this.crystalSynth.triggerAttackRelease(n, '32n', now + 0.5 + i * 0.1, 0.15);
                });
            } else {
                // Mysterious, Deep & Warm (Amber Caves)
                const chord = ['D3', 'F#3', 'A3', 'C#4']; // Dmaj7 for a warmer feel
                this.ambientSynth.triggerAttackRelease(chord, '1n', now, 0.2);
                this.bassSynth.triggerAttackRelease('D2', '1n', now, 0.2);
                
                // Deep, resonant melody notes
                const melody = ['A4', 'F#4', 'D5', 'E4'];
                const mNote = melody[Math.floor(Math.random() * melody.length)];
                this.crystalSynth.triggerAttackRelease(mNote, '2n', now + 0.5, 0.08);
                
                // Subtle rhythmic pulse
                this.impactSynth.triggerAttackRelease('D1', '8n', now + 2, 0.05);
            }

            this.musicLoopId = setTimeout(playCycle, 6000 + Math.random() * 2000);
        };
        
        playCycle();
    }

    stopMusic() {
        if (this.musicLoopId) {
            clearTimeout(this.musicLoopId);
            this.musicLoopId = null;
        }
    }

    playCrystalChime() {
        this.playMatch();
    }

    playPop() {
        if (!this.sfxEnabled) return;
        this.ensureAudioContext();
        this.impactSynth.triggerAttackRelease('G4', '16n', Tone.now() + 0.01, 0.3);
    }

    playSuccessFanfare() {
        if (!this.sfxEnabled) return;
        this.ensureAudioContext();
        const now = Tone.now();
        const chord = ['C4', 'E4', 'G4', 'C5'];
        this.crystalSynth.triggerAttackRelease(chord, '2n', now, 0.6);
        this.impactSynth.triggerAttackRelease('C2', '4n', now, 0.5);
        
        // Rising notes
        ['C5', 'E5', 'G5', 'C6'].forEach((n, i) => {
            this.crystalSynth.triggerAttackRelease(n, '8n', now + i * 0.15, 0.5);
        });
    }

    playLoseSound() {
        if (!this.sfxEnabled) return;
        this.ensureAudioContext();
        const now = Tone.now();
        // Magic Fade
        this.ambientSynth.triggerAttackRelease(['G2', 'B2', 'D3'], '1n', now, 0.3);
        this.crystalSynth.triggerAttackRelease('G3', '2n', now, 0.2);
        this.crystalSynth.triggerAttackRelease('F3', '2n', now + 0.5, 0.15);
        this.crystalSynth.triggerAttackRelease('E3', '1n', now + 1, 0.1);
    }

    playUnlock() {
        this.playSuccessFanfare();
    }

    playError() {
        if (!this.sfxEnabled) return;
        this.ensureAudioContext();
        const synth = new Tone.DuoSynth({ volume: -15 }).toDestination();
        synth.triggerAttackRelease("G2", "16n");
    }

    playBoosterExplosion() { this.playCrystalBlast(); }
    playPowerUp() { this.playMagicChime(); }
    
    playObstacleBreaker() {
        if (!this.sfxEnabled) return;
        this.ensureAudioContext();
        if (this.throttleSound('obstacle-breaker', 0.2)) return;
        
        this.duckMusic(0.4, 1.0);

        const now = Tone.now();
        // Powerful chord + rising notes
        this.impactSynth.triggerAttackRelease('C2', '2n', now, 0.8);
        this.shatterSynth.triggerAttackRelease('2n', now, 0.4);
        
        ['G4', 'C5', 'E5', 'G5', 'C6'].forEach((n, i) => {
            this.crystalSynth.triggerAttackRelease(n, '16n', now + i * 0.08, 0.6);
        });
    }

    playLevelStart() {
        if (!this.sfxEnabled) return;
        this.ensureAudioContext();
        const now = Tone.now();
        
        this.crystalSynth.triggerAttackRelease(['C4', 'G4', 'C5'], '2n', now, 0.6);
        this.impactSynth.triggerAttackRelease('C2', '2n', now, 0.4);
        
        // Fast rising arpeggio for a cinematic "launch" feel
        ['C5', 'E5', 'G5', 'C6', 'E6', 'G6', 'C7'].forEach((n, i) => {
            this.crystalSynth.triggerAttackRelease(n, '16n', now + i * 0.05, 0.5);
        });
    }

    playEpicFanfare() {
        if (!this.sfxEnabled) return;
        this.ensureAudioContext();
        const now = Tone.now();
        
        // Grand opening chord with ambient swell
        const chord1 = ['C3', 'G3', 'C4', 'E4', 'G4'];
        this.ambientSynth.triggerAttackRelease(chord1, '1n', now, 0.4);
        this.bassSynth.triggerAttackRelease('C2', '1n', now, 0.3);
        
        // Triumphant rising arpeggio
        const sequence = ['C4', 'E4', 'G4', 'C5', 'E5', 'G5', 'C6', 'E6', 'G6', 'C7'];
        sequence.forEach((note, i) => {
            this.crystalSynth.triggerAttackRelease(note, '8n', now + i * 0.1, 0.6);
        });
        
        // Final booming impact for the castle arrival
        this.impactSynth.triggerAttackRelease('C1', '2n', now + 1.0, 0.8);
        this.shatterSynth.triggerAttackRelease('1n', now + 1.0, 0.5);
        this.crystalSynth.triggerAttackRelease(['C5', 'G5', 'C6'], '1n', now + 1.0, 0.7);
    }

    playMapMusic() { 
        const level = typeof window !== 'undefined' && window.progressManager ? window.progressManager.getUnlockedLevel() : 1;
        if (level >= 51) this.startMusic('archipelago');
        else if (level >= 26) this.startMusic('caves');
        else this.startMusic('forest');
    }
    playGameMusic(levelId) { 
        if (levelId >= 51) this.startMusic('archipelago');
        else if (levelId >= 26) this.startMusic('caves');
        else this.startMusic('forest');
    }
    playLoadingMusic() { this.startMusic('loading'); }

    playSplash() {
        if (!this.sfxEnabled) return;
        this.ensureAudioContext();
        if (this.throttleSound('splash', 0.1)) return;
        this.shatterSynth.triggerAttackRelease('8n', Tone.now() + 0.01, 0.3);
        this.impactSynth.triggerAttackRelease('G4', '16n', Tone.now() + 0.01, 0.2);
    }

    playBloopZip() {
        if (!this.sfxEnabled) return;
        this.ensureAudioContext();
        const now = Tone.now();
        // Bloop
        this.impactSynth.triggerAttackRelease('G4', '16n', now, 0.4);
        // Zip
        this.crystalSynth.triggerAttackRelease('C6', '32n', now + 0.05, 0.4);
        this.crystalSynth.triggerAttackRelease('G6', '32n', now + 0.1, 0.4);
        this.crystalSynth.triggerAttackRelease('C7', '16n', now + 0.15, 0.4);
    }
}

export const soundManager = new SoundManager();