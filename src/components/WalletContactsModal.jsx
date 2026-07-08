import React, { useEffect, useMemo, useState } from 'react';
import {
  deleteContact,
  getContacts,
  saveContact,
  sortContacts,
  toggleContactFavorite,
  updateContact,
} from '../utils/walletContacts';

const abbreviateAddress = (address) => {
  if (!address) return '';
  if (address.length <= 11) return address;
  return `${address.slice(0, 5)}…${address.slice(-5)}`;
};

export default function WalletContactsModal({
  open,
  mode = 'manage',
  onClose,
  onSelectContact,
  prefillAddress = '',
}) {
  const [contacts, setContacts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [view, setView] = useState('list');
  const [editingContact, setEditingContact] = useState(null);
  const [formError, setFormError] = useState(null);
  const [form, setForm] = useState({
    name: '',
    address: '',
    notes: '',
    isFavorite: false,
  });

  const reloadContacts = () => setContacts(getContacts());

  useEffect(() => {
    if (!open) return;
    reloadContacts();
    setView('list');
    setEditingContact(null);
    setFormError(null);
    setSearchQuery('');
  }, [open]);

  const filteredContacts = useMemo(() => {
    let list = sortContacts(contacts, sortBy);
    const query = searchQuery.trim().toLowerCase();
    if (!query) return list;
    return list.filter((contact) =>
      contact.name.toLowerCase().includes(query)
      || contact.address.includes(query)
      || (contact.notes && contact.notes.toLowerCase().includes(query)),
    );
  }, [contacts, searchQuery, sortBy]);

  const openCreateForm = () => {
    setEditingContact(null);
    setForm({
      name: '',
      address: prefillAddress || '',
      notes: '',
      isFavorite: false,
    });
    setFormError(null);
    setView('form');
  };

  const openEditForm = (contact) => {
    setEditingContact(contact);
    setForm({
      name: contact.name,
      address: contact.address,
      notes: contact.notes || '',
      isFavorite: Boolean(contact.isFavorite),
    });
    setFormError(null);
    setView('form');
  };

  const handleSaveForm = (event) => {
    event.preventDefault();
    setFormError(null);
    try {
      if (editingContact) {
        updateContact(editingContact.id, form);
      } else {
        saveContact(form);
      }
      reloadContacts();
      setView('list');
      setEditingContact(null);
    } catch (err) {
      setFormError(err.message || 'Failed to save contact');
    }
  };

  const handleDelete = (contact) => {
    if (!window.confirm(`Delete contact "${contact.name}"?`)) return;
    deleteContact(contact.id);
    reloadContacts();
  };

  const handleToggleFavorite = (contact) => {
    toggleContactFavorite(contact.id);
    reloadContacts();
  };

  if (!open) return null;

  return (
    <div className="bunker-modal-overlay" onClick={onClose}>
      <div
        className="bunker-modal wallet-contacts-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="wallet-contacts-modal__header">
          <h2 className="bunker-heading" style={{ margin: 0 }}>
            {mode === 'select' ? 'Select Contact' : 'Contacts'}
          </h2>
          <button type="button" className="compact-btn !m-0" onClick={onClose}>
            Close
          </button>
        </div>

        {view === 'form' ? (
          <form onSubmit={handleSaveForm} className="wallet-contacts-form">
            <div className="mb-4">
              <label className="bunker-label">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                className="bunker-input"
                placeholder="e.g. Mining pool"
                required
              />
            </div>
            <div className="mb-4">
              <label className="bunker-label">Address</label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value.trim() }))}
                className="bunker-input"
                placeholder="48-character Warthog address"
                required
              />
            </div>
            <div className="mb-4">
              <label className="bunker-label">Notes (optional)</label>
              <input
                type="text"
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                className="bunker-input"
                placeholder="Optional note"
              />
            </div>
            <label className="wallet-contacts-form__favorite">
              <input
                type="checkbox"
                checked={form.isFavorite}
                onChange={(e) => setForm((prev) => ({ ...prev, isFavorite: e.target.checked }))}
              />
              <span>Favorite</span>
            </label>
            {formError ? <div className="bunker-alert" style={{ marginTop: '0.75rem' }}>{formError}</div> : null}
            <div className="wallet-contacts-form__actions">
              <button type="submit" className="bunker-btn bunker-btn--primary !m-0">
                {editingContact ? 'Save Changes' : 'Add Contact'}
              </button>
              <button
                type="button"
                className="compact-btn !m-0"
                onClick={() => {
                  setView('list');
                  setEditingContact(null);
                  setFormError(null);
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="wallet-contacts-toolbar">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bunker-input"
                placeholder="Search contacts"
              />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bunker-select wallet-contacts-sort"
              >
                <option value="name">Name</option>
                <option value="recent">Recent</option>
                <option value="frequency">Frequent</option>
                <option value="favorites">Favorites</option>
              </select>
              <button type="button" className="compact-btn !m-0" onClick={openCreateForm}>
                Add
              </button>
            </div>

            {filteredContacts.length === 0 ? (
              <p className="bunker-muted wallet-contacts-empty">
                {contacts.length === 0
                  ? 'No contacts yet. Add one to reuse addresses when sending WART.'
                  : 'No contacts match your search.'}
              </p>
            ) : (
              <ul className="wallet-contacts-list">
                {filteredContacts.map((contact) => (
                  <li key={contact.id} className="wallet-contacts-item">
                    <div className="wallet-contacts-item__main">
                      <button
                        type="button"
                        className={`wallet-contacts-item__favorite${contact.isFavorite ? ' is-active' : ''}`}
                        onClick={() => handleToggleFavorite(contact)}
                        title={contact.isFavorite ? 'Remove favorite' : 'Mark favorite'}
                        aria-label={contact.isFavorite ? 'Remove favorite' : 'Mark favorite'}
                      >
                        ★
                      </button>
                      <button
                        type="button"
                        className="wallet-contacts-item__select"
                        onClick={() => {
                          if (mode === 'select') {
                            onSelectContact?.(contact);
                            onClose?.();
                          } else {
                            openEditForm(contact);
                          }
                        }}
                      >
                        <span className="wallet-contacts-item__name">{contact.name}</span>
                        <span className="wallet-contacts-item__address" title={contact.address}>
                          {abbreviateAddress(contact.address)}
                        </span>
                        {contact.notes ? (
                          <span className="wallet-contacts-item__notes">{contact.notes}</span>
                        ) : null}
                      </button>
                    </div>
                    <div className="wallet-contacts-item__actions">
                      {mode === 'select' ? (
                        <button
                          type="button"
                          className="compact-btn !m-0"
                          onClick={() => {
                            onSelectContact?.(contact);
                            onClose?.();
                          }}
                        >
                          Use
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="compact-btn !m-0"
                            onClick={() => openEditForm(contact)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="compact-btn !m-0"
                            onClick={() => handleDelete(contact)}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}