export interface Contact {
id: string;
name: string;
email: string;
phone: string;
stage: "lead" | "client" | "hot";
assignedTo?: string;
}
