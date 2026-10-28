import SmartImage from './SmartImage';

export default function TeamCard({ member }) {
  return (
    <article className="team-card">
      <div className="team-card__media">
        <SmartImage
          src={member.image}
          alt={`Portrait representing ${member.name}, ${member.role}`}
          className="team-card__image"
          width="640"
          height="800"
        />
      </div>
      <div className="team-card__body">
        <h3 className="team-card__name">{member.name}</h3>
        <p className="team-card__role">{member.role}</p>
        <p className="team-card__bio">{member.bio}</p>
        {member.demo ? <span className="team-card__note">Sample profile</span> : null}
      </div>
    </article>
  );
}
