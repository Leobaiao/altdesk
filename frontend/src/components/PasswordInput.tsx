import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
}

export function PasswordInput({ label, error, style, ...props }: PasswordInputProps) {
    const [show, setShow] = useState(false);

    return (
        <div className="field" style={{ ...style, position: 'relative' }}>
            {label && <label>{label}</label>}
            <div style={{ position: 'relative' }}>
                <input
                    {...props}
                    type={show ? 'text' : 'password'}
                    style={{ paddingRight: 45, width: '100%' }}
                />
                <button
                    type="button"
                    onClick={() => setShow(!show)}
                    style={{
                        position: 'absolute',
                        right: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 0,
                        opacity: 0.7
                    }}
                    tabIndex={-1}
                >
                    {show ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
            </div>
            {error && <span className="error-text" style={{ fontSize: '12px', color: '#ef4444', marginTop: 4, display: 'block' }}>{error}</span>}
        </div>
    );
}
