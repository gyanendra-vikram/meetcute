import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import API from '../utils/api';

const genderOptions = [
  { value: 'woman', label: 'Women' },
  { value: 'man', label: 'Men' },
  { value: 'nonbinary', label: 'Non-binary people' },
];

const emptyForm = {
  name: '',
  bio: '',
  birthDate: '',
  gender: '',
  interestedIn: [],
  location: '',
  photoUrl: '',
  interests: '',
  allowNsfwMemes: false,
};

export default function Profile() {
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const { data } = await API.get('/dating/profile');
        setForm({
          ...emptyForm,
          name: data.name || '',
          bio: data.profile?.bio || '',
          birthDate: data.profile?.birthDate ? new Date(data.profile.birthDate).toISOString().slice(0, 10) : '',
          gender: data.profile?.gender || '',
          interestedIn: data.profile?.interestedIn || [],
          location: data.profile?.location || '',
          photoUrl: data.profile?.photoUrl || '',
          interests: (data.profile?.interests || []).join(', '),
          allowNsfwMemes: data.profile?.allowNsfwMemes === true,
        });
      } catch (error) {
        toast.error(error.response?.data?.msg || 'Could not load your profile');
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, []);

  const updateField = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const toggleInterestedIn = (value) => {
    setForm((current) => ({
      ...current,
      interestedIn: current.interestedIn.includes(value)
        ? current.interestedIn.filter((item) => item !== value)
        : [...current.interestedIn, value],
    }));
  };

  const handlePhotoUpload = async (event) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Photo must be 5 MB or smaller');
      input.value = '';
      return;
    }

    const upload = new FormData();
    upload.append('photo', file);
    setUploading(true);
    try {
      const { data } = await API.post('/dating/profile/photo', upload);
      setForm((current) => ({ ...current, photoUrl: data.photoUrl }));
      toast.success('Profile photo uploaded');
    } catch (error) {
      toast.error(error.response?.data?.msg || 'Could not upload your photo');
    } finally {
      setUploading(false);
      input.value = '';
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await API.put('/dating/profile', {
        ...form,
        interests: form.interests.split(',').map((interest) => interest.trim()).filter(Boolean),
      });
      toast.success('Your profile is ready');
      navigate('/discover');
    } catch (error) {
      toast.error(error.response?.data?.msg || 'Could not save your profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <main className="dating-page"><div className="empty-state">Loading your profile…</div></main>;

  return (
    <main className="dating-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">A LITTLE ABOUT YOU</p>
          <h1>Your profile</h1>
          <p className="muted">Share what makes you, you. You must be 18 or older to join.</p>
        </div>
        <Link className="text-link" to="/discover">Back to discover</Link>
      </header>

      <form className="profile-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label className="form-field">
            <span>Your name</span>
            <input name="name" value={form.name} onChange={updateField} required minLength="2" maxLength="60" />
          </label>
          <label className="form-field">
            <span>Birthday</span>
            <input
              type="date"
              name="birthDate"
              value={form.birthDate}
              onChange={updateField}
              max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().slice(0, 10)}
              required
            />
          </label>
          <label className="form-field">
            <span>I identify as</span>
            <select name="gender" value={form.gender} onChange={updateField} required>
              <option value="">Choose one</option>
              <option value="woman">Woman</option>
              <option value="man">Man</option>
              <option value="nonbinary">Non-binary</option>
            </select>
          </label>
          <fieldset className="form-field preference-field">
            <legend>I’d like to meet</legend>
            <div className="choice-row">
              {genderOptions.map((option) => (
                <label className="choice-chip" key={option.value}>
                  <input
                    type="checkbox"
                    checked={form.interestedIn.includes(option.value)}
                    onChange={() => toggleInterestedIn(option.value)}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="form-field">
            <span>City or area</span>
            <input name="location" value={form.location} onChange={updateField} maxLength="100" placeholder="e.g. Portland" />
          </label>
          <div className="form-field">
            <label htmlFor="profile-photo">Profile photo</label>
            <input
              id="profile-photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhotoUpload}
              disabled={uploading}
            />
            <small>JPEG, PNG, or WebP. Maximum 5 MB.</small>
            {form.photoUrl && <img className="photo-preview" src={form.photoUrl} alt="Profile preview" />}
            <label htmlFor="photo-url">Or paste a photo URL</label>
            <input id="photo-url" name="photoUrl" type="url" value={form.photoUrl} onChange={updateField} maxLength="500" placeholder="https://…" />
          </div>
          <label className="form-field form-field-wide">
            <span>Your intro</span>
            <textarea name="bio" value={form.bio} onChange={updateField} rows="4" maxLength="500" placeholder="A few things you love, what you're looking for, or an ideal first date…" />
            <small>{form.bio.length}/500</small>
          </label>
          <label className="form-field form-field-wide">
            <span>Interests</span>
            <input name="interests" value={form.interests} onChange={updateField} placeholder="Coffee, hiking, live music" />
            <small>Separate interests with commas (up to 12).</small>
          </label>
          <fieldset className="form-field form-field-wide preference-field">
            <legend>Meme content</legend>
            <label className="choice-chip">
              <input
                type="checkbox"
                checked={form.allowNsfwMemes}
                onChange={(event) => setForm((current) => ({ ...current, allowNsfwMemes: event.target.checked }))}
              />
              Show NSFW memes in Discover
            </label>
            <small>Off by default. This is available only to accounts verified as 18 or older.</small>
          </fieldset>
        </div>
        <div className="form-actions">
          <button className="button button-primary" type="submit" disabled={saving || uploading}>
            {uploading ? 'Uploading photo…' : saving ? 'Saving…' : 'Save my profile'}
          </button>
          <Link className="text-link" to="/discover">Cancel</Link>
        </div>
      </form>
    </main>
  );
}
