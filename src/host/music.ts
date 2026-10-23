/**
 * Background music: an original 8-bit loop played by a tiny step sequencer,
 * NES style (two pulse channels, a triangle bass, a noise drum kit), all
 * synthesized with WebAudio, no assets.
 */

export type Track = "menu" | "sprint" | "boss"

type Quality = "min" | "maj"

interface Song {
  readonly bpm: number
  /** One chord per bar: root as a note name, arpeggiated in 16ths. */
  readonly chords: ReadonlyArray<readonly [string, Quality]>
  /** One line per bar, 16 sixteenths: a note, `.` for a rest, `-` to hold. */
  readonly lead: ReadonlyArray<string>
  /** Drum hits per bar: k kick, s snare, h hi-hat, `.` nothing. */
  readonly drums: string
  /** Calm songs arpeggiate in slow eighths over long bass notes, softly. */
  readonly calm?: boolean
}

const songs: Record<Track, Song> = {
  // C major, drifting down F–Em–Dm–C: the menu, the coffee before the sprint.
  menu: {
    bpm: 92,
    calm: true,
    chords: [["F3", "maj"], ["E3", "min"], ["D3", "min"], ["C3", "maj"], ["F3", "maj"], ["E3", "min"], ["D3", "min"], ["C3", "maj"]],
    lead: [
      "A4 - - - C5 - - - E5 - - - - - - -",
      "D5 - - - B4 - - - G4 - - - - - - -",
      "F4 - - - A4 - - - D5 - - - C5 - - -",
      "C5 - - - - - - - G4 - - - - - - -",
      "C5 - - - A4 - - - C5 - - - F5 - - -",
      "E5 - - - - - - - D5 - - - B4 - - -",
      "A4 - - - D5 - - - F5 - - - E5 - - -",
      "C5 - - - - - - - - - - - . . . ."
    ],
    drums: "................"
  },
  // A minor, i–VI–III–VII: the classic "level 1, here we go" progression.
  sprint: {
    bpm: 152,
    chords: [["A3", "min"], ["F3", "maj"], ["C3", "maj"], ["G3", "maj"], ["A3", "min"], ["F3", "maj"], ["C3", "maj"], ["G3", "maj"]],
    lead: [
      "A4 . A4 C5 E5 . D5 C5 D5 . E5 . A4 - - .",
      "F4 . A4 C5 F5 . E5 D5 C5 . D5 . E5 - - .",
      "G4 . C5 E5 G5 . F5 E5 D5 . E5 . C5 - D5 .",
      "B4 . D5 . G5 . B5 - A5 . G5 . D5 - B4 .",
      "E5 E5 . E5 . A5 . E5 C6 - B5 - A5 . E5 .",
      "F5 F5 . F5 . A5 . F5 C6 - A5 - F5 . C5 .",
      "G5 G5 . G5 . C6 . G5 E6 - D6 - C6 . G5 .",
      "D6 - - B5 - - G5 - D6 - - B5 . G5 A5 B5"
    ],
    drums: "k.h.s.h.k.k.s.hh"
  },
  // D minor and faster, ending each round on a tense A major.
  boss: {
    bpm: 168,
    chords: [["D3", "min"], ["A#2", "maj"], ["C3", "maj"], ["A2", "maj"]],
    lead: [
      "D5 . D5 . F5 . D5 . A5 . G5 F5 E5 . D5 .",
      "D5 . D5 . F5 . D5 . A#5 . A5 G5 F5 . D5 .",
      "E5 . E5 . G5 . E5 . C6 . A#5 A5 G5 . E5 .",
      "C#5 - E5 - A5 - C#6 - E6 - - - C#6 . A5 ."
    ],
    drums: "k.hks.hkk.hks.ss"
  }
}

const semitones: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

/** "C#5" → MIDI note number. */
const midi = (name: string): number => {
  const match = /^([A-G])(#?)(-?\d)$/.exec(name)
  if (!match) throw new Error(`Bad note: ${name}`)
  return 12 * (Number(match[3]) + 1) + semitones[match[1]!]! + (match[2] ? 1 : 0)
}

const hz = (note: number): number => 440 * Math.pow(2, (note - 69) / 12)

interface Note {
  readonly note: number
  /** In sixteenths. */
  readonly length: number
}

interface Step {
  readonly lead: Note | null
  readonly arp: Note | null
  readonly bass: Note | null
  readonly drum: string
}

/** The calm arpeggio, in eighths: up through the chord and back down. */
const calmArp = (third: number) => [0, 7, 12, 12 + third, 19, 12 + third, 12, 7]

/** Flattens a song into 16th-note steps, resolving holds into note lengths. */
const compile = (song: Song): ReadonlyArray<Step> => {
  const steps: Step[] = []
  song.lead.forEach((line, bar) => {
    const tokens = line.split(" ")
    if (tokens.length !== 16) throw new Error(`Bar ${bar} has ${tokens.length} steps`)
    const [root, quality] = song.chords[bar % song.chords.length]!
    const base = midi(root)
    const third = quality === "min" ? 3 : 4
    const chord = [0, third, 7, 12]
    tokens.forEach((token, i) => {
      let length = 0
      if (token !== "." && token !== "-") {
        length = 1
        while (tokens[i + length] === "-") length++
      }
      steps.push({
        lead: length > 0 ? { note: midi(token), length } : null,
        arp: song.calm
          ? i % 2 === 0 ? { note: base + calmArp(third)[i / 2]!, length: 2 } : null
          : { note: base + 12 + chord[i % 4]!, length: 1 },
        bass: song.calm
          ? i % 8 === 0 ? { note: base - 12, length: 8 } : null
          // Octave-bouncing eighths, the bass line of half the 80s.
          : i % 2 === 0 ? { note: base - 12 + (i % 4 === 2 ? 12 : 0), length: 2 } : null,
        drum: song.drums[i] ?? "."
      })
    })
  })
  return steps
}

const compiled: Record<Track, ReadonlyArray<Step>> = { menu: compile(songs.menu), sprint: compile(songs.sprint), boss: compile(songs.boss) }

/** A pulse wave with the given duty cycle: 0.125 and 0.25 are the NES timbres. */
const pulse = (ctx: BaseAudioContext, duty: number): PeriodicWave => {
  const harmonics = 48
  const real = new Float32Array(harmonics)
  const imag = new Float32Array(harmonics)
  for (let n = 1; n < harmonics; n++) real[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty)
  return ctx.createPeriodicWave(real, imag)
}

const LOOKAHEAD = 0.15
const TICK_MS = 25

export const makeMusic = (ctx: BaseAudioContext, destination: AudioNode) => {
  const out = ctx.createGain()
  out.gain.value = 0.55
  out.connect(destination)
  const leadWave = pulse(ctx, 0.25)
  const arpWave = pulse(ctx, 0.125)
  const softWave = pulse(ctx, 0.5)
  const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  const samples = noiseBuffer.getChannelData(0)
  for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1

  let track: Track | null = null
  let step = 0
  let nextTime = 0
  let timer: number | null = null

  const voice = (wave: PeriodicWave | OscillatorType, frequency: number, at: number, duration: number, volume: number) => {
    const osc = ctx.createOscillator()
    if (wave instanceof PeriodicWave) osc.setPeriodicWave(wave)
    else osc.type = wave
    osc.frequency.value = frequency
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(volume, at)
    gain.gain.setValueAtTime(volume, at + duration * 0.7)
    gain.gain.linearRampToValueAtTime(0, at + duration)
    osc.connect(gain).connect(out)
    osc.start(at)
    osc.stop(at + duration + 0.01)
  }

  const hit = (at: number, duration: number, volume: number, filter: BiquadFilterType, cutoff: number) => {
    const source = ctx.createBufferSource()
    source.buffer = noiseBuffer
    const shape = ctx.createBiquadFilter()
    shape.type = filter
    shape.frequency.value = cutoff
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(volume, at)
    gain.gain.exponentialRampToValueAtTime(0.001, at + duration)
    source.connect(shape).connect(gain).connect(out)
    source.start(at, Math.random() * 0.5, duration + 0.01)
  }

  const kick = (at: number) => {
    const osc = ctx.createOscillator()
    osc.type = "sine"
    osc.frequency.setValueAtTime(160, at)
    osc.frequency.exponentialRampToValueAtTime(40, at + 0.12)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.5, at)
    gain.gain.exponentialRampToValueAtTime(0.001, at + 0.16)
    osc.connect(gain).connect(out)
    osc.start(at)
    osc.stop(at + 0.17)
  }

  const play = (song: Song, { lead, arp, bass, drum }: Step, at: number) => {
    const sixteenth = 60 / song.bpm / 4
    if (song.calm) {
      if (lead) voice(softWave, hz(lead.note), at, sixteenth * lead.length * 0.95, 0.06)
      if (arp) voice(arpWave, hz(arp.note), at, sixteenth * arp.length * 0.9, 0.03)
      if (bass) voice("triangle", hz(bass.note), at, sixteenth * bass.length * 0.95, 0.22)
    } else {
      if (lead) voice(leadWave, hz(lead.note), at, sixteenth * lead.length * 0.92, 0.11)
      if (arp) voice(arpWave, hz(arp.note), at, sixteenth * arp.length * 0.6, 0.045)
      if (bass) voice("triangle", hz(bass.note), at, sixteenth * bass.length * 0.9, 0.32)
    }
    if (drum === "k") kick(at)
    if (drum === "s") hit(at, 0.12, 0.22, "highpass", 1500)
    if (drum === "h") hit(at, 0.035, 0.08, "highpass", 7000)
  }

  const schedule = () => {
    if (!track) return
    const song = songs[track]
    const steps = compiled[track]
    // After a stall (a background tab), skip ahead instead of playing a burst of late notes.
    if (nextTime < ctx.currentTime) nextTime = ctx.currentTime + 0.02
    while (nextTime < ctx.currentTime + LOOKAHEAD) {
      play(song, steps[step % steps.length]!, nextTime)
      step = (step + 1) % steps.length
      nextTime += 60 / song.bpm / 4
    }
  }

  return {
    /** Starts `next`, or keeps going if it is already playing; a new track starts from its top. */
    play: (next: Track) => {
      if (next !== track) step = 0
      track = next
      if (timer !== null) return
      nextTime = ctx.currentTime + 0.05
      schedule()
      timer = window.setInterval(schedule, TICK_MS)
    },
    /** Stops after the notes already queued; `play` with the same track resumes where it was. */
    stop: () => {
      if (timer !== null) window.clearInterval(timer)
      timer = null
    },
    /** The next `play` starts from the top. */
    rewind: () => {
      step = 0
    }
  }
}

export type Music = ReturnType<typeof makeMusic>
