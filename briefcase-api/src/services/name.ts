type NameInput = {
    fullName?: unknown;
    firstName?: unknown;
    lastName?: unknown;
};

function asText(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
}

export function splitPersonName(input: NameInput) {
    const fullName = asText(input.fullName);
    const firstName = asText(input.firstName);
    const lastName = asText(input.lastName);

    if (firstName || lastName) {
        return {
            firstName,
            lastName,
            name: [firstName, lastName].filter(Boolean).join(" ") || fullName,
        };
    }

    if (!fullName) {
        return { firstName: "", lastName: "", name: "" };
    }

    const commaMatch = fullName.match(/^(.+?),\s*(.+)$/);
    if (commaMatch) {
        return {
            firstName: commaMatch[2].trim().split(/\s+/)[0] ?? "",
            lastName: commaMatch[1].trim(),
            name: fullName,
        };
    }

    const parts = fullName.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
        return { firstName: parts[0], lastName: "", name: fullName };
    }

    return {
        firstName: parts[0],
        lastName: parts[parts.length - 1],
        name: fullName,
    };
}