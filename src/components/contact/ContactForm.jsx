import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, Send } from 'lucide-react';
import FormField from '../common/FormField';

const baseValues = {
  name: '',
  email: '',
  phone: '',
  subject: '',
  message: '',
};

const validate = (values) => {
  const errors = {};

  if (!values.name.trim()) errors.name = 'Enter your name.';
  else if (values.name.trim().length < 2) errors.name = 'Your name must be at least 2 characters.';

  if (!values.email.trim()) errors.email = 'Enter your email address.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = 'Enter a valid email address.';
  }

  const phoneDigits = values.phone.replace(/[^\d]/g, '');
  if (!values.phone.trim()) errors.phone = 'Enter your phone number.';
  else if (phoneDigits.length < 7 || phoneDigits.length > 15) {
    errors.phone = 'Enter a valid phone number with 7–15 digits.';
  }

  if (!values.subject.trim()) errors.subject = 'Add a subject for your enquiry.';
  else if (values.subject.trim().length < 3) {
    errors.subject = 'The subject must be at least 3 characters.';
  }

  if (!values.message.trim()) errors.message = 'Tell us how we can help.';
  else if (values.message.trim().length < 10) {
    errors.message = 'Your message must be at least 10 characters.';
  }

  return errors;
};

export default function ContactForm() {
  const [searchParams] = useSearchParams();
  const [values, setValues] = useState(() => ({
    ...baseValues,
    subject: searchParams.get('subject') || '',
  }));
  const [errors, setErrors] = useState({});
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const updateField = (field) => (event) => {
    setValues((current) => ({ ...current, [field]: event.target.value }));
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    if (hasSubmitted) setHasSubmitted(false);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const nextErrors = validate(values);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setHasSubmitted(false);
      return;
    }

    // Frontend-only demonstration: no email service or backend is connected.
    setHasSubmitted(true);
    setValues(baseValues);
  };

  return (
    <form className="contact-form" onSubmit={handleSubmit} noValidate>
      {hasSubmitted ? (
        <div className="form-success" role="status">
          <CheckCircle2 size={20} aria-hidden="true" />
          <div>
            <p className="form-success__title">Message validated locally</p>
            <p>
              This is a frontend-only demonstration. Your message was not emailed, delivered to
              EstateVista or saved on a server.
            </p>
          </div>
        </div>
      ) : null}

      {Object.keys(errors).length > 0 ? (
        <p className="form-error-summary" role="alert">
          Please correct the highlighted fields before continuing.
        </p>
      ) : null}

      <div className="contact-form__grid">
        <FormField
          label="Name"
          id="contact-name"
          name="name"
          value={values.name}
          onChange={updateField('name')}
          error={errors.name}
          required
          autoComplete="name"
        />
        <FormField
          label="Email"
          id="contact-email"
          name="email"
          type="email"
          value={values.email}
          onChange={updateField('email')}
          error={errors.email}
          required
          autoComplete="email"
        />
        <FormField
          label="Phone"
          id="contact-phone"
          name="phone"
          type="tel"
          value={values.phone}
          onChange={updateField('phone')}
          error={errors.phone}
          required
          autoComplete="tel"
        />
        <FormField
          label="Subject"
          id="contact-subject"
          name="subject"
          value={values.subject}
          onChange={updateField('subject')}
          error={errors.subject}
          required
        />
        <FormField
          label="Message"
          id="contact-message"
          name="message"
          as="textarea"
          rows="6"
          value={values.message}
          onChange={updateField('message')}
          error={errors.message}
          required
          className="contact-form__message"
          placeholder="Tell us about the property, location or service you have in mind."
        />
      </div>

      <div className="contact-form__footer">
        <button type="submit" className="button button--primary button--md">
          <Send size={16} aria-hidden="true" />
          Submit message
        </button>
        <p>
          Demonstration form only. No message is sent, and no personal information is stored.
        </p>
      </div>
    </form>
  );
}
