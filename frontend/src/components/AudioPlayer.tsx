import React, { useRef, useState, useEffect } from "react";

export function AudioPlayer({ src }: { src: string }) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [playing, setPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    const togglePlay = () => {
        if (!audioRef.current) return;
        if (playing) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setPlaying(!playing);
    };

    const onTimeUpdate = () => {
        if (!audioRef.current) return;
        setCurrentTime(audioRef.current.currentTime);
    };

    const onLoadedMetadata = () => {
        if (!audioRef.current) return;
        setDuration(audioRef.current.duration);
    };

    const onEnded = () => {
        setPlaying(false);
        setCurrentTime(0);
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!audioRef.current) return;
        const time = Number(e.target.value);
        audioRef.current.currentTime = time;
        setCurrentTime(time);
    };

    const formatTime = (t: number) => {
        if (!t) return "0:00";
        const m = Math.floor(t / 60);
        const s = Math.floor(t % 60);
        return `${m}:${s.toString().padStart(2, "0")}`;
    };

    return (
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(0,0,0,0.2)", padding: "8px 12px", borderRadius: 8, marginTop: 4 }}>
            <button
                onClick={togglePlay}
                style={{
                    background: "none",
                    border: "none",
                    color: "#e9edef",
                    fontSize: "20px",
                    cursor: "pointer",
                    width: 24,
                    height: 24,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                }}
            >
                {playing ? "⏸" : "▶"}
            </button>

            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <input
                    type="range"
                    min={0}
                    max={duration || 0}
                    value={currentTime}
                    onChange={handleSeek}
                    style={{ width: "100%", cursor: "pointer", accentColor: "#00a884" }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#8696a0", marginTop: 2 }}>
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                </div>
            </div>

            <audio
                ref={audioRef}
                src={src}
                onTimeUpdate={onTimeUpdate}
                onLoadedMetadata={onLoadedMetadata}
                onEnded={onEnded}
            />
        </div>
    );
}
