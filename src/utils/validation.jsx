// validation.jsx
import { supabase } from "@/globals";

// String cleaning and formatting utilities
export const cleanName = (name) => (name || "").trim().replace(/\s{2,}/g, " ");

export const capitalizeWords = (str) => {
    return (str || "")
        .replace(/\s+/g, " ")
        .split(" ")
        .map(
            (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
        .join(" ");
};

export const formatPhoneNumber = (number) => {
    const digits = String(number || "").replace(/\D/g, "");
    return digits.length >= 10 ? digits.slice(-10) : digits;
};

// Pattern detection for suspicious numbers
export const detectSuspiciousPattern = (number) => {
    const repeatingPattern = /(\d)\1{9,}/;
    if (repeatingPattern.test(number)) {
        return "Contact number contains too many repeated digits (max 3 in a row)";
    }

    let sequentialCount = 1;
    for (let i = 1; i < number.length; i++) {
        const current = parseInt(number[i]);
        const previous = parseInt(number[i - 1]);

        if (current === previous + 1 || current === previous - 1) {
            sequentialCount++;
            if (sequentialCount >= 4) {
                return "Contact number contains suspicious sequential pattern (max 3 in sequence)";
            }
        } else {
            sequentialCount = 1;
        }
    }

    return null;
};

// Email validation
export const validateEmail = (email) => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
    return emailRegex.test(email);
};

// Password validation
export const validatePassword = (password) => {
    return {
        length: password.length >= 8 && password.length <= 32,
        uppercase: /[A-Z]/.test(password),
        lowercase: /[a-z]/.test(password),
        number: /[0-9]/.test(password),
        hasLetter: /[a-zA-Z]/.test(password),
        hasNumber: /[0-9]/.test(password),
        specialCharacters: /[^a-zA-Z0-9]/.test(password),
    };
};

export const isPasswordValid = (password) => {
    const checks = validatePassword(password);
    return Object.values(checks).every((check) => check);
};

// Contact number validation
export const validateContactNumber = (contactNumber) => {
    const errors = [];

    if (!/^9\d{9}$/.test(String(contactNumber))) {
        errors.push("Contact number must be 10 digits starting with 9.");
    } else {
        const patternError = detectSuspiciousPattern(String(contactNumber));
        if (patternError) {
            errors.push(patternError);
        }
    }

    return errors;
};

// Check if email exists in database
export const checkEmailExists = async (email, excludeEmail = null) => {
    if (!email || !validateEmail(email)) {
        return { exists: false, error: null };
    }

    // If we're editing and the email hasn't changed, skip the check
    if (excludeEmail && email === excludeEmail) {
        return { exists: false, error: null };
    }

    try {
        const { data, error } = await supabase
            .from("contacts")
            .select("email")
            .eq("email", email)
            .maybeSingle();

        if (error) throw error;
        return { exists: !!data, error: null };
    } catch (error) {
        console.error("Error checking email:", error);
        return { exists: false, error: error.message };
    }
};

// Check if contact number exists in database
export const checkContactExists = async (
    contactNumber,
    excludeUserId = null
) => {
    const cleanedNumber = contactNumber.replace(/\D/g, "");

    if (
        !cleanedNumber ||
        cleanedNumber.length !== 10 ||
        !cleanedNumber.startsWith("9")
    ) {
        return { exists: false, valid: false, error: null };
    }

    const fullNumber = `+63${cleanedNumber}`;

    try {
        let query = supabase
            .from("contacts")
            .select("contact_number, user_id")
            .eq("contact_number", fullNumber);

        // If we're editing, exclude the current user's record
        if (excludeUserId) {
            query = query.neq("user_id", excludeUserId);
        }

        const { data, error } = await query.maybeSingle();

        if (error) throw error;
        return { exists: !!data, valid: true, error: null };
    } catch (error) {
        console.error("Error checking contact:", error);
        return { exists: false, valid: true, error: error.message };
    }
};

// Comprehensive user form validation
export const validateUserForm = (
    data,
    availableRoles = [],
    emailExists = false,
    contactExists = false
) => {
    const errors = [];
    const {
        first_name = "",
        last_name = "",
        email = "",
        role = "",
        contact_number = "",
        place_id = "",
    } = data;

    const cleanedFirstName = cleanName(first_name);
    const cleanedLastName = cleanName(last_name);

    // Required fields check
    if (
        !cleanedFirstName ||
        !cleanedLastName ||
        !email ||
        !role ||
        !place_id ||
        !contact_number
    ) {
        errors.push("All fields are required.");
    }

    // First name validation
    if (cleanedFirstName && !/^[a-zA-Z\s]{2,}$/.test(cleanedFirstName)) {
        errors.push(
            "First name must contain only letters and spaces (min 2 characters)."
        );
    }

    // Last name validation
    if (cleanedLastName && !/^[a-zA-Z\s]{2,}$/.test(cleanedLastName)) {
        errors.push(
            "Last name must contain only letters and spaces (min 2 characters)."
        );
    }

    // Email validation
    if (email && !validateEmail(email)) {
        errors.push(
            "Please enter a valid Gmail address (e.g., user@gmail.com)."
        );
    } else if (email && emailExists) {
        errors.push("Email already registered.");
    }

    // Role validation
    if (role && availableRoles.length > 0 && !availableRoles.includes(role)) {
        errors.push("Please select a valid role.");
    }

    // Contact number validation
    if (contact_number) {
        const contactErrors = validateContactNumber(contact_number);
        errors.push(...contactErrors);

        if (contactErrors.length === 0 && contactExists) {
            errors.push("Contact number already registered.");
        }
    }

    return errors;
};
