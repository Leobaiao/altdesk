import React from 'react';

interface PhoneMaskInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
}

export function PhoneMaskInput({ label, error, onChange, value, ...props }: PhoneMaskInputProps) {
    const formatPhone = (val: string) => {
        // Remove tudo o que não é dígito
        const digits = val.replace(/\D/g, '');
        
        // Aplica a máscara padrão brasileira: (99) 99999-9999 ou (99) 9999-9999
        let formatted = digits;
        if (digits.length > 10) {
            formatted = `(${digits.substring(0, 2)}) ${digits.substring(2, 7)}-${digits.substring(7, 11)}`;
        } else if (digits.length > 6) {
            formatted = `(${digits.substring(0, 2)}) ${digits.substring(2, 6)}-${digits.substring(6, 10)}`;
        } else if (digits.length > 2) {
            formatted = `(${digits.substring(0, 2)}) ${digits.substring(2, 7)}`;
        } else if (digits.length > 0) {
            formatted = `(${digits.substring(0, 2)}`;
        }
        
        return formatted;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (onChange) {
            const formatted = formatPhone(e.target.value);
            e.target.value = formatted;
            onChange(e);
        }
    };

    return (
        <div className="field">
            {label && <label>{label}</label>}
            <input
                {...props}
                type="text"
                value={value}
                onChange={handleChange}
                placeholder="(11) 99999-0000"
            />
            {error && <span className="error-text" style={{ fontSize: '12px', color: '#ef4444', marginTop: 4, display: 'block' }}>{error}</span>}
        </div>
    );
}
