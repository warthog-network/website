const STORAGE_KEY = 'warthog_contacts_v1';

function generateId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeContactAddress(address) {
  if (typeof address !== 'string') return '';
  return address.trim().toLowerCase();
}

export function getContacts() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveContacts(contacts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(contacts));
}

export function saveContact({ name, address, notes = '', isFavorite = false }) {
  const normalizedAddress = normalizeContactAddress(address);
  if (!name?.trim()) {
    throw new Error('Contact name is required');
  }
  if (normalizedAddress.length !== 48) {
    throw new Error('Contact address must be 48 characters');
  }

  const contacts = getContacts();
  if (contacts.some((c) => c.address === normalizedAddress)) {
    throw new Error('A contact with this address already exists');
  }

  const contact = {
    id: generateId(),
    name: name.trim(),
    address: normalizedAddress,
    notes: notes?.trim() || '',
    isFavorite: Boolean(isFavorite),
    usageCount: 0,
    createdAt: new Date().toISOString(),
    lastUsed: null,
  };

  saveContacts([...contacts, contact]);
  return contact;
}

export function updateContact(id, updates) {
  const contacts = getContacts();
  const index = contacts.findIndex((c) => c.id === id);
  if (index < 0) {
    throw new Error('Contact not found');
  }

  const nextAddress = updates.address != null
    ? normalizeContactAddress(updates.address)
    : contacts[index].address;

  if (updates.address != null && nextAddress.length !== 48) {
    throw new Error('Contact address must be 48 characters');
  }

  if (
    updates.address != null
    && contacts.some((c) => c.id !== id && c.address === nextAddress)
  ) {
    throw new Error('A contact with this address already exists');
  }

  const updated = {
    ...contacts[index],
    ...updates,
    name: updates.name != null ? updates.name.trim() : contacts[index].name,
    address: nextAddress,
    notes: updates.notes != null ? updates.notes.trim() : contacts[index].notes,
    isFavorite: updates.isFavorite != null ? Boolean(updates.isFavorite) : contacts[index].isFavorite,
  };

  contacts[index] = updated;
  saveContacts(contacts);
  return updated;
}

export function deleteContact(id) {
  const contacts = getContacts().filter((c) => c.id !== id);
  saveContacts(contacts);
}

export function toggleContactFavorite(id) {
  const contacts = getContacts();
  const contact = contacts.find((c) => c.id === id);
  if (!contact) throw new Error('Contact not found');
  return updateContact(id, { isFavorite: !contact.isFavorite });
}

export function getContactByAddress(address) {
  const normalized = normalizeContactAddress(address);
  if (!normalized) return null;
  return getContacts().find((c) => c.address === normalized) || null;
}

export function recordContactUsage(address) {
  const normalized = normalizeContactAddress(address);
  const contacts = getContacts();
  const index = contacts.findIndex((c) => c.address === normalized);
  if (index < 0) return false;

  contacts[index] = {
    ...contacts[index],
    usageCount: (contacts[index].usageCount || 0) + 1,
    lastUsed: new Date().toISOString(),
  };
  saveContacts(contacts);
  return true;
}

export function sortContacts(contacts, sortBy = 'name') {
  const list = [...contacts];
  switch (sortBy) {
    case 'recent':
      return list.sort((a, b) => {
        if (!a.lastUsed && !b.lastUsed) return 0;
        if (!a.lastUsed) return 1;
        if (!b.lastUsed) return -1;
        return new Date(b.lastUsed) - new Date(a.lastUsed);
      });
    case 'frequency':
      return list.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
    case 'favorites':
      return list.sort((a, b) => {
        if (a.isFavorite === b.isFavorite) return a.name.localeCompare(b.name);
        return a.isFavorite ? -1 : 1;
      });
    default:
      return list.sort((a, b) => a.name.localeCompare(b.name));
  }
}