from pydantic import BaseModel, Field

class FormalPetition(BaseModel):
    subject: str = Field(description="The subject line for the grievance email.")
    body: str = Field(description="The formal body of the grievance email.")

class RTIQuestion(BaseModel):
    question: str = Field(description="A specific RTI question regarding maintenance contracts or related issues.")

class HazardResponse(BaseModel):
    hazard_summary: str = Field(description="A brief summary of the civic hazard based on the image.")
    danger_score: int = Field(description="A danger score from 1 to 10.", ge=1, le=10)
    responsible_authority: str = Field(description="The municipal authority or department responsible for fixing this issue.")
    citizen_legal_rights: list[str] = Field(description="Relevant constitutional provisions (e.g. Article 21) or statutory municipal duties.")
    formal_petition: FormalPetition
    rti_questions: list[RTIQuestion]
    image_url: str = Field(default="", description="The URL of the uploaded image.")
