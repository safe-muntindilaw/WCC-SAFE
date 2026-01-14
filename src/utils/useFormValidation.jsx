// useFormValidation.js - Shared validation hook with debouncing
import { useState, useEffect } from "react";
import {
    validateEmail,
    validatePassword,
    isPasswordValid as checkPasswordValid,
    detectSuspiciousPattern,
    checkEmailExists,
    checkContactExists,
} from "./validation";

export const useEmailValidation = (
    email,
    isEditing = false,
    originalEmail = ""
) => {
    const [emailValidation, setEmailValidation] = useState({
        isValid: null,
        exists: false,
        checking: false,
        error: null,
        touched: false,
    });

    useEffect(() => {
        // Don't validate if email is empty
        if (!email) {
            setEmailValidation({
                isValid: false,
                exists: false,
                checking: false,
                error: null,
                touched: false,
            });
            return;
        }

        // Skip validation if email hasn't changed during edit
        if (isEditing && email === originalEmail) {
            setEmailValidation({
                isValid: null,
                exists: false,
                checking: false,
                error: null,
                touched: false,
            });
            return;
        }

        // Mark as touched when user changes the value
        if (!emailValidation.touched) {
            setEmailValidation((prev) => ({ ...prev, touched: true }));
        }

        const timer = setTimeout(async () => {
            // Check format first
            if (!validateEmail(email)) {
                setEmailValidation({
                    isValid: false,
                    exists: false,
                    checking: false,
                    error: "Invalid email format",
                    touched: true,
                });
                return;
            }

            setEmailValidation({
                isValid: null,
                exists: false,
                checking: true,
                error: null,
                touched: true,
            });

            const result = await checkEmailExists(
                email,
                isEditing ? originalEmail : null
            );

            setEmailValidation({
                isValid: !result.exists && !result.error,
                exists: result.exists,
                checking: false,
                error: result.error,
                touched: true,
            });
        }, 500);

        return () => clearTimeout(timer);
    }, [email, isEditing, originalEmail]);

    return emailValidation;
};

export const useContactValidation = (
    contactNumber,
    isEditing = false,
    userId = null,
    originalContactNumber = ""
) => {
    const [contactValidation, setContactValidation] = useState({
        isValid: null,
        exists: false,
        checking: false,
        error: null,
        touched: false,
    });

    useEffect(() => {
        // Don't validate if contact is empty
        if (!contactNumber) {
            setContactValidation({
                isValid: null,
                exists: false,
                checking: false,
                error: null,
                touched: false,
            });
            return;
        }

        // Clean both numbers for comparison
        const cleanedCurrent = contactNumber.replace(/\D/g, "");
        const cleanedOriginal = originalContactNumber.replace(/\D/g, "");

        // Skip validation if contact hasn't changed during edit
        if (isEditing && cleanedCurrent === cleanedOriginal) {
            setContactValidation({
                isValid: null,
                exists: false,
                checking: false,
                error: null,
                touched: false,
            });
            return;
        }

        const hasChanged = cleanedCurrent !== cleanedOriginal;

        // Don't validate if editing and hasn't been touched yet
        if (isEditing && !hasChanged) {
            setContactValidation({
                isValid: null,
                exists: false,
                checking: false,
                error: null,
                touched: false,
            });
            return;
        }

        // Mark as touched when user changes the value
        if (hasChanged) {
            setContactValidation((prev) => ({ ...prev, touched: true }));
        }

        const timer = setTimeout(async () => {
            // Check format first
            if (
                cleanedCurrent.length !== 10 ||
                !cleanedCurrent.startsWith("9")
            ) {
                setContactValidation({
                    isValid: false,
                    exists: false,
                    checking: false,
                    error: "Invalid format",
                    touched: true,
                });
                return;
            }

            // Check for suspicious patterns
            const patternError = detectSuspiciousPattern(cleanedCurrent);
            if (patternError) {
                setContactValidation({
                    isValid: false,
                    exists: false,
                    checking: false,
                    error: patternError,
                    touched: true,
                });
                return;
            }

            setContactValidation({
                isValid: null,
                exists: false,
                checking: true,
                error: null,
                touched: true,
            });

            const result = await checkContactExists(
                cleanedCurrent,
                isEditing ? userId : null
            );

            setContactValidation({
                isValid: result.valid && !result.exists,
                exists: result.exists,
                checking: false,
                error: result.error,
                touched: true,
            });
        }, 500);

        return () => clearTimeout(timer);
    }, [contactNumber, isEditing, userId, originalContactNumber]);

    return contactValidation;
};

export const usePasswordValidation = (password, confirmPassword = "") => {
    const [passwordValidation, setPasswordValidation] = useState({
        checks: {
            length: false,
            uppercase: false,
            lowercase: false,
            number: false,
            specialCharacters: false,
        },
        isValid: false,
        passwordsMatch: false,
        strength: 0,
    });

    useEffect(() => {
        const checks = validatePassword(password);
        const isValid = checkPasswordValid(password);
        const passwordsMatch =
            password === confirmPassword && password.length > 0;
        const strength = password
            ? (Object.values(checks).filter(Boolean).length / 5) * 100
            : 0;

        setPasswordValidation({
            checks,
            isValid,
            passwordsMatch: confirmPassword ? passwordsMatch : true,
            strength,
        });
    }, [password, confirmPassword]);

    return passwordValidation;
};
