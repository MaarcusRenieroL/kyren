/* eslint-disable @typescript-eslint/no-explicit-any */
import { Label } from "@zentro/ui/shadcn/label";
import { Input } from "@zentro/ui/shadcn/input";
import { NativeSelect } from "@zentro/ui/shadcn/native-select";
import { Textarea } from "@zentro/ui/shadcn/textarea";
import { Button } from "@zentro/ui/shadcn/button";
import { Fragment } from "react";
import { AboutContactSent } from "./contact-sent-card";

export function AboutContactForm({ v }: { v: any }) {
  const {
    notSent,
    sent,
    submit,
    hasErrs,
    errSummary,
    ico,
    fm,
    topics,
    sentName,
    sentEmail,
    resetForm,
  } = v;

  return (
    <div style={{ maxWidth: "720px" }}>
      {notSent ? (
        <form
          onSubmit={submit}
          noValidate
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "stretch",
            gap: "22px",
          }}
        >
          {hasErrs ? (
            <div
              role="alert"
              style={{
                display: "flex",
                gap: "12px",
                alignItems: "flex-start",
                padding: "14px 16px",
                borderRadius: "14px",
                border: "1px solid var(--rose)",
                background: "color-mix(in oklab, var(--rose) 8%, transparent)",
                fontSize: "14px",
                lineHeight: "1.5",
              }}
            >
              <span style={ico.alert}></span>
              <span>{errSummary}</span>
            </div>
          ) : null}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "var(--fmCols)",
              gap: "22px",
            }}
          >
            <Label
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "stretch",
                gap: "8px",
              }}
            >
              <span style={{ fontSize: "14px", fontWeight: "500" }}>Name</span>
              <Input
                value={fm.name.val}
                onChange={fm.name.onChange}
                onBlur={fm.name.onBlur}
                placeholder="Mira Okafor"
                style={fm.name.inSt}
              />
              {fm.name.has ? (
                <span
                  style={{
                    fontSize: "13px",
                    lineHeight: "1.45",
                    color: "var(--rose)",
                  }}
                >
                  {fm.name.err}
                </span>
              ) : null}
            </Label>
            <Label
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "stretch",
                gap: "8px",
              }}
            >
              <span style={{ fontSize: "14px", fontWeight: "500" }}>
                Work email
              </span>
              <Input
                value={fm.email.val}
                onChange={fm.email.onChange}
                onBlur={fm.email.onBlur}
                placeholder="name@company.com"
                style={fm.email.inSt}
              />
              {fm.email.has ? (
                <span
                  style={{
                    fontSize: "13px",
                    lineHeight: "1.45",
                    color: "var(--rose)",
                  }}
                >
                  {fm.email.err}
                </span>
              ) : null}
            </Label>
          </div>
          <Label
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "stretch",
              gap: "8px",
            }}
          >
            <span style={{ fontSize: "14px", fontWeight: "500" }}>Topic</span>
            <div style={{ position: "relative" }}>
              <NativeSelect
                value={fm.topic.val}
                onChange={fm.topic.onChange}
                onBlur={fm.topic.onBlur}
                style={fm.topic.inSt}
              >
                <option value="">Choose a topic</option>
                {topics.map((t: any, i47: number) => (
                  <Fragment key={i47}>
                    <option value={t}>{t}</option>
                  </Fragment>
                ))}
              </NativeSelect>
            </div>
            {fm.topic.has ? (
              <span
                style={{
                  fontSize: "13px",
                  lineHeight: "1.45",
                  color: "var(--rose)",
                }}
              >
                {fm.topic.err}
              </span>
            ) : null}
          </Label>
          <Label
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "stretch",
              gap: "8px",
            }}
          >
            <span
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "14px",
                fontWeight: "500",
              }}
            >
              Message
              <span
                style={{
                  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                  fontSize: "11px",
                  fontWeight: "400",
                  color: "var(--ink3)",
                }}
              >
                At least 20 characters
              </span>
            </span>
            <Textarea
              value={fm.msg.val}
              onChange={fm.msg.onChange}
              onBlur={fm.msg.onBlur}
              placeholder="What can we help with?"
              style={fm.msg.inSt}
            ></Textarea>
            {fm.msg.has ? (
              <span
                style={{
                  fontSize: "13px",
                  lineHeight: "1.45",
                  color: "var(--rose)",
                }}
              >
                {fm.msg.err}
              </span>
            ) : null}
          </Label>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              flexWrap: "wrap",
              paddingTop: "4px",
            }}
          >
            <Button
              variant="custom"
              type="submit"
              style={{
                display: "inline-flex",
                alignItems: "center",
                height: "48px",
                padding: "0 24px",
                borderRadius: "999px",
                border: "none",
                background: "var(--btn)",
                color: "var(--btn-ink)",
                fontSize: "15px",
                fontWeight: "500",
                cursor: "pointer",
              }}
            >
              Send message
            </Button>
            <span style={{ fontSize: "13px", color: "var(--ink3)" }}>
              We only use your email to reply.
            </span>
          </div>
        </form>
      ) : null}
      {sent ? <AboutContactSent v={v} /> : null}
    </div>
  );
}
