import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface AdapterData {
  ipv4?: string;
  subnetMask?: string;
  defaultGateway?: string;
}

export async function GET() {
  try {
    const { stdout } = await execAsync('ipconfig');
    const parsed = parseIpconfig(stdout);
    return NextResponse.json({ adapters: parsed });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to run ipconfig';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function parseIpconfig(output: string): Record<string, AdapterData> {
  const lines = output.split('\n');
  const adapters: Record<string, AdapterData> = {};
  let currentAdapter: string | null = null;

  for (let line of lines) {
    line = line.trim();
    if (line === '') continue;

    if (line.endsWith(':') && /adapter/i.test(line)) {
      currentAdapter = line.replace(':', '').trim();
      adapters[currentAdapter] = {};
      continue;
    }

    if (!currentAdapter) continue;

    const ipv4Match = line.match(/IPv4 Address[.\s]*:\s*(.+)/);
    const subnetMatch = line.match(/Subnet Mask[.\s]*:\s*(.+)/);
    const gatewayMatch = line.match(/Default Gateway[.\s]*:\s*(.+)/);

    if (ipv4Match) adapters[currentAdapter].ipv4 = ipv4Match[1].trim();
    if (subnetMatch) adapters[currentAdapter].subnetMask = subnetMatch[1].trim();
    if (gatewayMatch && !adapters[currentAdapter].defaultGateway) {
      adapters[currentAdapter].defaultGateway = gatewayMatch[1].trim();
    }
  }

  return adapters;
}
