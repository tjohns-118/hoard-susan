export interface Agent {
id: string;
name: string;
leads: number;
conversion: number;
status: "momentum" | "stable" | "needs-attention";
}
